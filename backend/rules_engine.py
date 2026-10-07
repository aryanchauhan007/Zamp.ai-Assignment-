"""
rules_engine.py -- Deterministic, ordered business-rule evaluation.

Design principles:
  - Rules are pure Python -- no LLM calls, no probabilistic decisions.
  - Rules run in a fixed order; each appends a RuleResult to the audit trail.
  - The engine short-circuits on the first FLAGGED / REJECTED outcome,
    but ALWAYS logs every rule evaluated (pass or fail) for the reasoning trail.
  - All thresholds come from config.py -- never hardcoded here.
"""

from __future__ import annotations

import difflib
import os
import sys
from datetime import datetime, timezone
from typing import Callable

sys.path.insert(0, os.path.dirname(__file__))

from config import (
    APPROVED_VENDORS,
    ARITHMETIC_TOLERANCE,
    CONFIDENCE_THRESHOLD,
    CRITICAL_FIELDS,
    FUZZY_AMOUNT_TOLERANCE,
    FUZZY_VENDOR_THRESHOLD,
    TOLERANCE_FLOOR,
    TOLERANCE_PERCENT,
)
from models import Decision, Invoice, PurchaseOrder, RuleResult


# -------------------------------------------------------------------------
# Type alias: a rule function signature
# -------------------------------------------------------------------------

RuleContext = dict   # carries invoice, pos, find_duplicate_fn, matched_po (mutable)


# -------------------------------------------------------------------------
# Helpers
# -------------------------------------------------------------------------

def _tolerance_for(po_amount: float) -> float:
    return max(po_amount * TOLERANCE_PERCENT, TOLERANCE_FLOOR)


def _fuzzy_ratio(a: str, b: str) -> float:
    return difflib.SequenceMatcher(None, a.lower().strip(), b.lower().strip()).ratio()


# -------------------------------------------------------------------------
# Rule 1 -- Critical field / low-confidence check
# -------------------------------------------------------------------------

def rule_critical_fields(ctx: RuleContext) -> RuleResult:
    """
    Flag if any critical field is missing (empty/None) OR has a confidence
    score below the threshold.
    Returns a failing RuleResult (FLAGGED) or passing one.
    """
    invoice: Invoice = ctx["invoice"]
    low_fields: list[str] = []

    for field in CRITICAL_FIELDS:
        value = getattr(invoice, field, None)
        conf  = invoice.extraction_confidence.get(field, 1.0)

        if not value or conf < CONFIDENCE_THRESHOLD:
            low_fields.append(
                f"{field} (confidence {conf:.2f})" if conf < CONFIDENCE_THRESHOLD else f"{field} (missing)"
            )

    if low_fields:
        return RuleResult(
            rule_name="critical_field_check",
            passed=False,
            detail=f"Low-confidence or missing extraction on: {', '.join(low_fields)}",
        )
    return RuleResult(
        rule_name="critical_field_check",
        passed=True,
        detail=f"All critical fields present with confidence >= {CONFIDENCE_THRESHOLD}",
    )


# -------------------------------------------------------------------------
# Rule 2 —— Arithmetic integrity check
# -------------------------------------------------------------------------

def rule_arithmetic(ctx: RuleContext) -> RuleResult:
    """
    Verify the internal arithmetic of the invoice:
      1. sum(line_item amounts) ≈ subtotal  (only if line items are present)
      2. subtotal + tax ≈ total
    Surfaces math errors in the decision trail, not just the pipeline stage log.
    """
    invoice: Invoice = ctx["invoice"]
    issues: list[str] = []

    # Check 1: line-item totals match subtotal
    if invoice.line_items:
        computed_subtotal = round(
            sum(li.quantity * li.unit_price for li in invoice.line_items), 2
        )
        if abs(computed_subtotal - invoice.subtotal) > ARITHMETIC_TOLERANCE:
            issues.append(
                f"Line items sum ${computed_subtotal:,.2f} ≠ subtotal ${invoice.subtotal:,.2f}"
            )

    # Check 2: subtotal + tax matches total
    computed_total = round(invoice.subtotal + invoice.tax, 2)
    if abs(computed_total - invoice.total) > ARITHMETIC_TOLERANCE:
        issues.append(
            f"Subtotal ${invoice.subtotal:,.2f} + tax ${invoice.tax:,.2f} "
            f"= ${computed_total:,.2f} ≠ claimed total ${invoice.total:,.2f}"
        )

    if issues:
        return RuleResult(
            rule_name="arithmetic_check",
            passed=False,
            detail=f"Arithmetic mismatch: {'; '.join(issues)}",
        )
    return RuleResult(
        rule_name="arithmetic_check",
        passed=True,
        detail=(
            f"Arithmetic verified: subtotal ${invoice.subtotal:,.2f} "
            f"+ tax ${invoice.tax:,.2f} = ${invoice.total:,.2f}"
        ),
    )


# -------------------------------------------------------------------------
# Rule 3 —— Approved-vendor check
# -------------------------------------------------------------------------

def rule_approved_vendor(ctx: RuleContext) -> RuleResult:
    """
    Confirm the extracted vendor name matches an entry on the approved-vendor
    whitelist (APPROVED_VENDORS in config.py).  Uses the same fuzzy-match
    threshold as PO matching, so minor abbreviation variants still pass.
    """
    invoice: Invoice = ctx["invoice"]

    for approved in APPROVED_VENDORS:
        if _fuzzy_ratio(invoice.vendor_name, approved) >= FUZZY_VENDOR_THRESHOLD:
            return RuleResult(
                rule_name="approved_vendor_check",
                passed=True,
                detail=(
                    f"Vendor '{invoice.vendor_name}' matches approved vendor "
                    f"'{approved}'"
                ),
            )

    return RuleResult(
        rule_name="approved_vendor_check",
        passed=False,
        detail=(
            f"Vendor '{invoice.vendor_name}' is not on the approved-vendor list — "
            f"payment requires manual authorisation"
        ),
    )


# -------------------------------------------------------------------------
# Rule 5 —— PO matching
# -------------------------------------------------------------------------

def rule_po_match(ctx: RuleContext) -> RuleResult:
    """
    Try exact PO reference lookup first; fall back to fuzzy match on
    vendor name + amount proximity.  Stores the matched PO in ctx["matched_po"].
    """
    invoice: Invoice  = ctx["invoice"]
    all_pos: list[PurchaseOrder] = ctx["all_pos"]

    matched: PurchaseOrder | None = None

    # Exact reference lookup
    if invoice.po_reference:
        for po in all_pos:
            if po.po_id.strip().upper() == invoice.po_reference.strip().upper():
                matched = po
                break

    # Fuzzy fallback
    if matched is None:
        for po in all_pos:
            vendor_sim = _fuzzy_ratio(invoice.vendor_name, po.vendor_name)
            amount_delta = abs(invoice.total - po.po_amount)
            amount_ok = amount_delta <= po.po_amount * FUZZY_AMOUNT_TOLERANCE

            if vendor_sim >= FUZZY_VENDOR_THRESHOLD and amount_ok:
                matched = po
                break

    if matched is None:
        return RuleResult(
            rule_name="po_match",
            passed=False,
            detail=(
                f"No matching PO found for vendor '{invoice.vendor_name}' "
                f"(PO ref: {invoice.po_reference or 'none provided'})"
            ),
        )

    ctx["matched_po"] = matched
    return RuleResult(
        rule_name="po_match",
        passed=True,
        detail=f"Matched PO {matched.po_id} (vendor: {matched.vendor_name}, amount: ${matched.po_amount:,.2f})",
    )


# -------------------------------------------------------------------------
# Rule 6 —— PO status check
# -------------------------------------------------------------------------

def rule_po_status(ctx: RuleContext) -> RuleResult:
    """
    Reject invoices that have been matched to a closed or cancelled PO.
    An open PO is required before any new invoice can be accepted against it.
    Skipped (passes) if no PO was matched in the previous step.
    """
    po: PurchaseOrder | None = ctx.get("matched_po")

    if po is None:
        return RuleResult(
            rule_name="po_status_check",
            passed=True,
            detail="Skipped — no PO was matched",
        )

    if po.status != "open":
        return RuleResult(
            rule_name="po_status_check",
            passed=False,
            detail=(
                f"PO {po.po_id} has status '{po.status}' — "
                f"only open POs can accept new invoices"
            ),
        )

    return RuleResult(
        rule_name="po_status_check",
        passed=True,
        detail=f"PO {po.po_id} is open — eligible for invoicing",
    )


# -------------------------------------------------------------------------
# Rule 7 —— Amount tolerance
# -------------------------------------------------------------------------

def rule_tolerance(ctx: RuleContext) -> RuleResult:
    """
    Flag if the invoice total EXCEEDS the PO amount by more than the tolerance band.
    Under-billing (invoice < PO) is always acceptable -- partial/split deliveries are normal.
    Only over-billing requires human review.
    """
    invoice: Invoice         = ctx["invoice"]
    po: PurchaseOrder | None = ctx.get("matched_po")

    if po is None:
        return RuleResult(
            rule_name="tolerance_check",
            passed=True,
            detail="Skipped -- no PO was matched",
        )

    tolerance = _tolerance_for(po.po_amount)
    # overage: positive means invoice is larger than the PO (over-billing)
    overage = invoice.total - po.po_amount

    if overage <= tolerance:
        return RuleResult(
            rule_name="tolerance_check",
            passed=True,
            detail=(
                f"Invoice ${invoice.total:,.2f} vs PO ${po.po_amount:,.2f} "
                f"(overage ${overage:,.2f}, tolerance ${tolerance:,.2f}) -- within tolerance"
            ),
        )
    return RuleResult(
        rule_name="tolerance_check",
        passed=False,
        detail=(
            f"Invoice total ${invoice.total:,.2f} vs PO ${po.po_amount:,.2f} "
            f"(delta ${overage:,.2f}, tolerance ${tolerance:,.2f}) -- exceeds tolerance"
        ),
    )


# -------------------------------------------------------------------------
# Rule 8 —— Split-PO cumulative check
# -------------------------------------------------------------------------

def rule_split_po_cumulative(ctx: RuleContext) -> RuleResult:
    invoice: Invoice         = ctx["invoice"]
    po: PurchaseOrder | None = ctx.get("matched_po")

    if po is None:
        return RuleResult(
            rule_name="split_po_cumulative",
            passed=True,
            detail="Skipped -- no PO was matched",
        )

    # How many invoices are already counted against this PO?
    existing_invoices: list[dict] = ctx.get("invoices_against_po", [])
    n_prior = len(existing_invoices)

    proposed_cumulative = po.cumulative_invoiced + invoice.total
    tolerance = _tolerance_for(po.po_amount)
    limit     = po.po_amount + tolerance

    if proposed_cumulative > limit:
        return RuleResult(
            rule_name="split_po_cumulative",
            passed=False,
            detail=(
                f"Cumulative invoiced (${proposed_cumulative:,.2f}) would exceed "
                f"PO amount ${po.po_amount:,.2f} (limit with tolerance: ${limit:,.2f}) "
                f"across {n_prior + 1} invoice(s)"
            ),
        )

    return RuleResult(
        rule_name="split_po_cumulative",
        passed=True,
        detail=(
            f"Cumulative ${proposed_cumulative:,.2f} within PO limit ${limit:,.2f} "
            f"({n_prior + 1} invoice(s) against this PO)"
        ),
    )


# -------------------------------------------------------------------------
# Rule 9 —— Duplicate detection
# -------------------------------------------------------------------------

def rule_duplicate(ctx: RuleContext) -> RuleResult:
    invoice: Invoice = ctx["invoice"]
    find_dup: Callable = ctx["find_duplicate_fn"]

    dup_id = find_dup(
        vendor_name=invoice.vendor_name,
        invoice_number=invoice.invoice_number,
        amount=invoice.total,
        date=invoice.invoice_date,
        exclude_id=invoice.id,
    )

    if dup_id:
        get_invoice_fn: Callable | None = ctx.get("get_invoice_fn")
        original_date = "unknown date"
        if get_invoice_fn:
            original = get_invoice_fn(dup_id)
            if original:
                original_date = original.invoice_date

        return RuleResult(
            rule_name="duplicate_check",
            passed=False,
            detail=(
                f"Duplicate of invoice {dup_id} "
                f"(same vendor '{invoice.vendor_name}' + invoice number '{invoice.invoice_number}' "
                f"or amount/date) processed on {original_date}"
            ),
        )

    return RuleResult(
        rule_name="duplicate_check",
        passed=True,
        detail=f"No duplicate found for vendor '{invoice.vendor_name}' / invoice '{invoice.invoice_number}'",
    )


# -------------------------------------------------------------------------
# Ordered rule list  (8 rules total)
# -------------------------------------------------------------------------
# Execution order is deliberate:
#   1. critical_field_check  — reject bad extractions first; no point running
#      expensive checks on unreliable data.
#   2. arithmetic_check      — surface internal fraud/encoding errors early.
#   3. duplicate_check       — hard stop on known fraud vector before any PO work.
#   4. approved_vendor_check — procurement gate; unknown vendors can't proceed.
#   5. po_match              — locate the governing PO.
#   6. po_status_check       — needs matched_po from step 5.
#   7. tolerance_check       — needs matched_po from step 5.
#   8. split_po_cumulative   — needs matched_po + cumulative from step 5.
# -------------------------------------------------------------------------

RULES: list[tuple[Callable, str, str]] = [
    (rule_critical_fields,     "FLAGGED_FOR_REVIEW", "LOW_CONFIDENCE_EXTRACTION"),
    (rule_arithmetic,          "FLAGGED_FOR_REVIEW", "ARITHMETIC_MISMATCH"),
    (rule_duplicate,           "REJECTED",           "DUPLICATE_INVOICE"),
    (rule_approved_vendor,     "FLAGGED_FOR_REVIEW", "UNAPPROVED_VENDOR"),
    (rule_po_match,            "FLAGGED_FOR_REVIEW", "NO_PO_MATCH"),
    (rule_po_status,           "FLAGGED_FOR_REVIEW", "PO_CLOSED"),
    (rule_tolerance,           "FLAGGED_FOR_REVIEW", "AMOUNT_OUT_OF_TOLERANCE"),
    (rule_split_po_cumulative, "FLAGGED_FOR_REVIEW", "SPLIT_PO_CUMULATIVE_EXCEEDED"),
]


# -------------------------------------------------------------------------
# Engine entry point
# -------------------------------------------------------------------------

def evaluate(
    invoice: Invoice,
    all_pos: list[PurchaseOrder],
    find_duplicate_fn: Callable,
    get_invoice_fn: Callable | None = None,
    invoices_against_po: list[dict] | None = None,
) -> Decision:
    """
    Run all rules in order against *invoice*.
    Short-circuits on the first failing rule but logs every rule evaluated.
    Returns a fully populated Decision.
    """
    ctx: RuleContext = {
        "invoice":            invoice,
        "all_pos":            all_pos,
        "matched_po":         None,
        "find_duplicate_fn":  find_duplicate_fn,
        "get_invoice_fn":     get_invoice_fn,
        "invoices_against_po": invoices_against_po or [],
    }

    evaluated: list[RuleResult] = []
    final_status: str     = "AUTO_APPROVED"
    final_reason_code: str  = "ALL_RULES_PASSED"
    final_reason_detail: str = "All business rules passed -- invoice auto-approved."
    short_circuited = False

    for rule_fn, outcome_if_failed, reason_code in RULES:
        result = rule_fn(ctx)
        evaluated.append(result)

        if not result.passed and not short_circuited:
            final_status        = outcome_if_failed
            final_reason_code   = reason_code
            final_reason_detail = result.detail
            short_circuited     = True
            # Continue evaluating remaining rules for the audit trail

    return Decision(
        invoice_id=invoice.id,
        status=final_status,
        reason_code=final_reason_code,
        reason_detail=final_reason_detail,
        rules_evaluated=evaluated,
        timestamp=datetime.now(timezone.utc).isoformat(),
    )
