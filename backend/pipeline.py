"""
pipeline.py — Async invoice processing pipeline.
Orchestrates: ingest → extract → validate → match_po → apply_rules → decide
Each stage writes RunLog entries so the frontend can poll progress in near-real-time.
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
import uuid
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(__file__))

from config import UPLOAD_DIR
from database import (
    find_duplicate,
    get_all_pos,
    get_invoice,
    get_run_logs,
    list_invoices,
    update_po_cumulative,
    upsert_decision,
    upsert_invoice,
    upsert_run_log,
)
from extractor import extract_invoice
from models import Decision, Invoice, RunLog
from rules_engine import evaluate

STAGES = ["ingest", "extract", "validate", "match_po", "apply_rules", "decide"]


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _log(
    run_id: str,
    invoice_id: str,
    stage: str,
    status: str,
    duration_ms: int | None = None,
    detail: str | None = None,
) -> None:
    upsert_run_log(RunLog(
        run_id=run_id,
        invoice_id=invoice_id,
        stage=stage,
        stage_status=status,
        duration_ms=duration_ms,
        detail=detail,
        timestamp=_now_iso(),
    ))


async def process_invoice(pdf_path: str, invoice_id: str) -> None:
    """
    Full async pipeline. Each stage:
      1. Writes a 'running' log entry.
      2. Does its work.
      3. Writes a 'complete' (or 'failed') log entry with duration.
    """
    run_id = str(uuid.uuid4())

    # ── Initialise all stages as 'pending' ────────────────────────────────────
    for stage in STAGES:
        _log(run_id, invoice_id, stage, "pending")

    # ─────────────────────────────────────────────────────────────────────────
    # Stage 1 — Ingest
    # ─────────────────────────────────────────────────────────────────────────
    _log(run_id, invoice_id, "ingest", "running")
    t0 = time.monotonic()
    try:
        if not os.path.exists(pdf_path):
            raise FileNotFoundError(f"PDF not found: {pdf_path}")
        file_size = os.path.getsize(pdf_path)
        await asyncio.sleep(0.1)  # yield to event loop
    except Exception as exc:
        _log(run_id, invoice_id, "ingest", "failed", detail=str(exc))
        return
    _log(run_id, invoice_id, "ingest", "complete",
         duration_ms=int((time.monotonic() - t0) * 1000),
         detail=f"File: {os.path.basename(pdf_path)} ({file_size} bytes)")

    # ─────────────────────────────────────────────────────────────────────────
    # Stage 2 — Extract
    # ─────────────────────────────────────────────────────────────────────────
    _log(run_id, invoice_id, "extract", "running")
    t0 = time.monotonic()
    try:
        invoice, method = await asyncio.get_event_loop().run_in_executor(
            None, extract_invoice, pdf_path, invoice_id
        )
    except Exception as exc:
        _log(run_id, invoice_id, "extract", "failed", detail=str(exc))
        return
    _log(run_id, invoice_id, "extract", "complete",
         duration_ms=int((time.monotonic() - t0) * 1000),
         detail=f"method={method}, vendor={invoice.vendor_name!r}, total=${invoice.total:,.2f}")

    # Persist extracted invoice immediately so polling can surface fields
    upsert_invoice(invoice)

    # ─────────────────────────────────────────────────────────────────────────
    # Stage 3 — Validate
    # ─────────────────────────────────────────────────────────────────────────
    _log(run_id, invoice_id, "validate", "running")
    t0 = time.monotonic()
    issues: list[str] = []

    # Arithmetic check: sum of line items should match subtotal (within $0.02)
    computed_subtotal = round(sum(li.quantity * li.unit_price for li in invoice.line_items), 2)
    if abs(computed_subtotal - invoice.subtotal) > 0.02 and invoice.line_items:
        issues.append(
            f"Subtotal mismatch: line items sum to ${computed_subtotal:,.2f}, "
            f"invoice claims ${invoice.subtotal:,.2f}"
        )

    # Totals: subtotal + tax should equal total
    computed_total = round(invoice.subtotal + invoice.tax, 2)
    if abs(computed_total - invoice.total) > 0.02:
        issues.append(
            f"Total mismatch: subtotal ${invoice.subtotal:,.2f} + tax ${invoice.tax:,.2f} "
            f"= ${computed_total:,.2f} but invoice total is ${invoice.total:,.2f}"
        )

    val_detail = "Validation passed" if not issues else "; ".join(issues)
    val_status = "complete"  # validation issues are informational only; rules engine decides
    _log(run_id, invoice_id, "validate", val_status,
         duration_ms=int((time.monotonic() - t0) * 1000),
         detail=val_detail)

    # ─────────────────────────────────────────────────────────────────────────
    # Stage 4 — Match PO
    # ─────────────────────────────────────────────────────────────────────────
    _log(run_id, invoice_id, "match_po", "running")
    t0 = time.monotonic()
    all_pos = get_all_pos()
    await asyncio.sleep(0.05)  # tiny yield — PO lookup is synchronous/fast
    _log(run_id, invoice_id, "match_po", "complete",
         duration_ms=int((time.monotonic() - t0) * 1000),
         detail=f"{len(all_pos)} POs loaded for matching")

    # ─────────────────────────────────────────────────────────────────────────
    # Stage 5 — Apply rules
    # ─────────────────────────────────────────────────────────────────────────
    _log(run_id, invoice_id, "apply_rules", "running")
    t0 = time.monotonic()
    decision: Decision = evaluate(
        invoice=invoice,
        all_pos=all_pos,
        find_duplicate_fn=find_duplicate,
        get_invoice_fn=get_invoice,
        invoices_against_po=[],   # DB already has cumulative_invoiced tracked
    )
    _log(run_id, invoice_id, "apply_rules", "complete",
         duration_ms=int((time.monotonic() - t0) * 1000),
         detail=f"{len(decision.rules_evaluated)} rules evaluated")

    # ─────────────────────────────────────────────────────────────────────────
    # Stage 6 — Decide (persist + update PO cumulative)
    # ─────────────────────────────────────────────────────────────────────────
    _log(run_id, invoice_id, "decide", "running")
    t0 = time.monotonic()

    # Find the matched PO from the decision's rule trail and update cumulative
    po_match_rule = next(
        (r for r in decision.rules_evaluated if r.rule_name == "po_match" and r.passed),
        None,
    )
    if po_match_rule and decision.status != "REJECTED":
        # Parse matched PO id from detail string "Matched PO PO-XXXX ..."
        import re
        m = re.search(r"Matched PO ([\w-]+)", po_match_rule.detail)
        if m:
            update_po_cumulative(m.group(1), invoice.total)

    upsert_decision(decision)

    _log(run_id, invoice_id, "decide", "complete",
         duration_ms=int((time.monotonic() - t0) * 1000),
         detail=f"{decision.status} — {decision.reason_code}")
