"""
test_rules_engine.py — Unit tests for the standalone rules engine.
Run with: python -m pytest backend/test_rules_engine.py -v
"""

from __future__ import annotations

import sys
import os

sys.path.insert(0, os.path.join(os.path.dirname(__file__), "backend"))
sys.path.insert(0, os.path.dirname(__file__))

import pytest

from models import Invoice, LineItem, PurchaseOrder
from rules_engine import evaluate


# ─────────────────────────────────────────────────────────────────────────────
# Shared fixtures
# ─────────────────────────────────────────────────────────────────────────────

def _make_invoice(**overrides) -> Invoice:
    defaults = dict(
        id="test-001",
        vendor_name="Acme Supplies",
        invoice_number="INV-001",
        invoice_date="2026-09-28",
        po_reference="PO-1001",
        line_items=[LineItem(description="Widgets", quantity=10, unit_price=100)],
        subtotal=1000.0,
        tax=100.0,
        total=1100.0,
        source_file="test.pdf",
        extraction_confidence={
            "vendor_name": 0.95,
            "invoice_number": 0.95,
            "total": 0.95,
        },
        extraction_method="text",
    )
    defaults.update(overrides)
    return Invoice(**defaults)


def _make_po(**overrides) -> PurchaseOrder:
    defaults = dict(
        po_id="PO-1001",
        vendor_name="Acme Supplies",
        po_amount=1100.0,
        po_date="2026-09-01",
        status="open",
        cumulative_invoiced=0.0,
    )
    defaults.update(overrides)
    return PurchaseOrder(**defaults)


def _no_dup(*args, **kwargs) -> None:
    return None


def _has_dup(*args, **kwargs) -> str:
    return "original-001"


# ─────────────────────────────────────────────────────────────────────────────
# Happy path
# ─────────────────────────────────────────────────────────────────────────────

def test_happy_path_auto_approved():
    inv = _make_invoice()
    po  = _make_po()
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "AUTO_APPROVED"
    assert dec.reason_code == "ALL_RULES_PASSED"
    # All 8 rules must be in the trail
    assert len(dec.rules_evaluated) == 8
    assert all(r.passed for r in dec.rules_evaluated)


# ─────────────────────────────────────────────────────────────────────────────
# Rule 1 — Low-confidence extraction
# ─────────────────────────────────────────────────────────────────────────────

def test_low_confidence_vendor_flags():
    inv = _make_invoice(
        extraction_confidence={
            "vendor_name": 0.50,   # below threshold
            "invoice_number": 0.90,
            "total": 0.90,
        }
    )
    dec = evaluate(inv, [_make_po()], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "LOW_CONFIDENCE_EXTRACTION"
    assert "vendor_name" in dec.reason_detail


def test_missing_invoice_number_flags():
    inv = _make_invoice(
        invoice_number="",
        extraction_confidence={"vendor_name": 0.95, "invoice_number": 0.00, "total": 0.95},
    )
    dec = evaluate(inv, [_make_po()], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "LOW_CONFIDENCE_EXTRACTION"


# ─────────────────────────────────────────────────────────────────────────────
# Rule 2 — PO matching
# ─────────────────────────────────────────────────────────────────────────────

def test_no_po_match_flags():
    inv = _make_invoice(po_reference="PO-UNKNOWN")
    dec = evaluate(inv, [], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "NO_PO_MATCH"


def test_fuzzy_po_match_succeeds():
    """Vendor name is slightly different but close enough for fuzzy match."""
    inv = _make_invoice(po_reference=None, vendor_name="Acme Supplies Inc")
    po  = _make_po(vendor_name="Acme Supplies", po_amount=1100.0)
    dec = evaluate(inv, [po], _no_dup)
    # Should still auto-approve via fuzzy match
    assert dec.status == "AUTO_APPROVED"


# ─────────────────────────────────────────────────────────────────────────────
# Rule 3 — Tolerance
# ─────────────────────────────────────────────────────────────────────────────

def test_amount_just_within_tolerance_approves():
    # PO $10,000; invoice $10,200 (2% = exactly at threshold)
    # line_items=[] skips the line-item arithmetic check; subtotal+tax=total is exact.
    inv = _make_invoice(total=10200.0, subtotal=9272.73, tax=927.27, line_items=[])
    po  = _make_po(po_amount=10000.0)
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "AUTO_APPROVED"


def test_amount_just_outside_tolerance_flags():
    # PO $10,000; invoice $10,310 (3.1% > 2% threshold)
    # 9372.73 + 937.27 = 10310.00 exactly — arithmetic passes, tolerance fails.
    inv = _make_invoice(total=10310.0, subtotal=9372.73, tax=937.27, line_items=[])
    po  = _make_po(po_amount=10000.0)
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "AMOUNT_OUT_OF_TOLERANCE"
    # Must include both amounts and the overage in the reason string
    assert "10,310" in dec.reason_detail or "10310" in dec.reason_detail
    assert "10,000" in dec.reason_detail or "10000" in dec.reason_detail
    assert "310" in dec.reason_detail   # overage/delta


def test_floor_tolerance_applies():
    # PO $100; 2% = $2 but floor is $25 → tolerance is $25
    # delta = $20 < $25 floor, so it should auto-approve.
    # 109.09 + 10.91 = 120.00 exactly; line_items=[] skips line-item check.
    inv = _make_invoice(total=120.0, subtotal=109.09, tax=10.91, line_items=[])
    po  = _make_po(po_amount=100.0)
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "AUTO_APPROVED"


# ─────────────────────────────────────────────────────────────────────────────
# Rule 4 — Split-PO cumulative
# ─────────────────────────────────────────────────────────────────────────────

def test_split_po_first_invoice_approves():
    # 2727.27 + 272.73 = 3000.00 exactly; line_items=[] skips line-item check.
    inv = _make_invoice(total=3000.0, subtotal=2727.27, tax=272.73, line_items=[])
    po  = _make_po(po_amount=6000.0, cumulative_invoiced=0.0)
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "AUTO_APPROVED"


def test_split_po_second_exceeds_flags():
    # First invoice already charged $3000; second would push to $6800 > $6000+tolerance.
    # 3454.54 + 345.46 = 3800.00 exactly; line_items=[] skips line-item check.
    inv = _make_invoice(
        id="test-002", invoice_number="INV-002",
        total=3800.0, subtotal=3454.54, tax=345.46, line_items=[]
    )
    po  = _make_po(po_amount=6000.0, cumulative_invoiced=3000.0)
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "SPLIT_PO_CUMULATIVE_EXCEEDED"
    # 3000 + 3800 = 6800 should appear in the detail
    assert "6,800" in dec.reason_detail or "6800" in dec.reason_detail


# ─────────────────────────────────────────────────────────────────────────────
# Rule 5 — Duplicate
# ─────────────────────────────────────────────────────────────────────────────

def test_duplicate_rejected():
    inv = _make_invoice()
    po  = _make_po()
    dec = evaluate(inv, [po], _has_dup, get_invoice_fn=lambda _: inv)
    assert dec.status == "REJECTED"
    assert dec.reason_code == "DUPLICATE_INVOICE"
    assert "original-001" in dec.reason_detail


# ─────────────────────────────────────────────────────────────────────────────
# Rule 2 — Arithmetic integrity
# ─────────────────────────────────────────────────────────────────────────────

def test_arithmetic_subtotal_mismatch_flags():
    """Line items sum does not match declared subtotal."""
    inv = _make_invoice(
        # Line items sum to 10 * 100 = 1000; we declare subtotal = 900 → mismatch
        subtotal=900.0,
        tax=90.0,
        total=990.0,
    )
    dec = evaluate(inv, [_make_po(po_amount=990.0)], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "ARITHMETIC_MISMATCH"
    assert "1,000" in dec.reason_detail or "1000" in dec.reason_detail


def test_arithmetic_total_mismatch_flags():
    """Subtotal + tax does not match the claimed total."""
    inv = _make_invoice(
        subtotal=1000.0,
        tax=100.0,
        total=1200.0,   # wrong — should be 1100
    )
    dec = evaluate(inv, [_make_po(po_amount=1200.0)], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "ARITHMETIC_MISMATCH"
    assert "1,200" in dec.reason_detail or "1200" in dec.reason_detail


# ─────────────────────────────────────────────────────────────────────────────
# Rule 4 — Approved-vendor check
# ─────────────────────────────────────────────────────────────────────────────

def test_unapproved_vendor_flags():
    """Vendor not on the approved-vendor whitelist triggers FLAGGED_FOR_REVIEW."""
    inv = _make_invoice(
        vendor_name="Rogue Supplies Ltd",
        po_reference=None,
    )
    dec = evaluate(inv, [], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "UNAPPROVED_VENDOR"
    assert "Rogue Supplies Ltd" in dec.reason_detail


def test_approved_vendor_fuzzy_match_passes():
    """Minor vendor name variant (suffix 'Inc') should still pass the approved check."""
    inv = _make_invoice(vendor_name="Acme Supplies Inc", po_reference="PO-1001")
    po  = _make_po(vendor_name="Acme Supplies")
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "AUTO_APPROVED"


# ─────────────────────────────────────────────────────────────────────────────
# Rule 6 — PO status check
# ─────────────────────────────────────────────────────────────────────────────

def test_closed_po_flags():
    """Invoice matched to a closed PO must be flagged, not approved."""
    inv = _make_invoice()
    po  = _make_po(status="closed")
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "FLAGGED_FOR_REVIEW"
    assert dec.reason_code == "PO_CLOSED"
    assert "closed" in dec.reason_detail


def test_open_po_passes_status_check():
    """Standard open PO should pass the status check without issue."""
    inv = _make_invoice()
    po  = _make_po(status="open")
    dec = evaluate(inv, [po], _no_dup)
    assert dec.status == "AUTO_APPROVED"


# ─────────────────────────────────────────────────────────────────────────────
# Audit trail completeness (updated for 8-rule engine)
# ─────────────────────────────────────────────────────────────────────────────

def test_all_rules_always_logged():
    """Even when rule 1 fails, all 8 rules must appear in the trail."""
    inv = _make_invoice(
        extraction_confidence={"vendor_name": 0.3, "invoice_number": 0.3, "total": 0.3}
    )
    dec = evaluate(inv, [_make_po()], _no_dup)
    assert len(dec.rules_evaluated) == 8
    rule_names = {r.rule_name for r in dec.rules_evaluated}
    assert "critical_field_check"  in rule_names
    assert "arithmetic_check"      in rule_names
    assert "duplicate_check"       in rule_names
    assert "approved_vendor_check" in rule_names
    assert "po_match"              in rule_names
    assert "po_status_check"       in rule_names
    assert "tolerance_check"       in rule_names
    assert "split_po_cumulative"   in rule_names


if __name__ == "__main__":
    import pytest as _pytest
    _pytest.main([__file__, "-v"])
