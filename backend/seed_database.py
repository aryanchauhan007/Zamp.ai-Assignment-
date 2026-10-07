"""
seed_database.py — Seed the SQLite database with PO data and historical demo invoices.

Pre-populates the database with:
  • 10 realistic purchase orders
  • 4 representative historical invoices (1 Happy Path, 2 Flagged, 1 Rejected)
so the dashboard opens with full production-grade data rather than looking like an empty toy.
"""

from __future__ import annotations

import json
import os
import shutil
import sys
from datetime import datetime, timezone

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import (
    init_db,
    upsert_decision,
    upsert_invoice,
    upsert_po,
    upsert_run_log,
)
from models import Decision, Invoice, LineItem, PurchaseOrder, RuleResult, RunLog


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEST_DATA_DIR = os.path.join(BASE_DIR, "test_data")
UPLOAD_DIR = os.path.join(BASE_DIR, "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)


def seed_purchase_orders() -> None:
    seed_file = os.path.join(BASE_DIR, "seed_pos.json")
    if not os.path.exists(seed_file):
        print(f"Warning: {seed_file} not found.")
        return

    with open(seed_file, encoding="utf-8") as f:
        pos_data = json.load(f)

    for entry in pos_data:
        po = PurchaseOrder(
            po_id=entry["po_id"],
            vendor_name=entry["vendor_name"],
            po_amount=entry["po_amount"],
            po_date=entry["po_date"],
            status=entry["status"],
            cumulative_invoiced=0.0,
        )
        upsert_po(po)

    print(f"  [OK] Seeded {len(pos_data)} purchase orders.")


def seed_historical_invoices() -> None:
    now_iso = datetime.now(timezone.utc).isoformat()

    # Pre-seed 4 distinct real scenarios
    scenarios = [
        # Scenario 1: Happy Path (Auto-Approved)
        {
            "id": "inv-hist-happy-01",
            "vendor_name": "Acme Supplies",
            "invoice_number": "INV-ACME-HIST-001",
            "invoice_date": "2026-09-15",
            "po_reference": "PO-1001",
            "subtotal": 2820.00,
            "tax": 282.00,
            "total": 3102.00,
            "source_file": "happy_01_acme.pdf",
            "confidence": {
                "vendor_name": 0.98,
                "invoice_number": 0.99,
                "invoice_date": 0.97,
                "po_reference": 0.95,
                "subtotal": 0.99,
                "tax": 0.96,
                "total": 0.99,
            },
            "extraction_method": "text",
            "line_items": [
                LineItem(description="Office Chairs Model Ergonomic", quantity=10, unit_price=150.00),
                LineItem(description="Standing Desks Motorized", quantity=4, unit_price=330.00),
            ],
            "decision": {
                "status": "AUTO_APPROVED",
                "reason_code": "ALL_RULES_PASSED",
                "reason_detail": "All business rules passed -- invoice auto-approved against PO-1001 within tolerance.",
                "rules": [
                    RuleResult(rule_name="critical_field_check", passed=True, detail="All critical fields present with confidence >= 0.70"),
                    RuleResult(rule_name="arithmetic_check", passed=True, detail="Arithmetic verified: subtotal $2,820.00 + tax $282.00 = $3,102.00"),
                    RuleResult(rule_name="duplicate_check", passed=True, detail="No duplicate found for vendor 'Acme Supplies' / invoice 'INV-ACME-HIST-001'"),
                    RuleResult(rule_name="approved_vendor_check", passed=True, detail="Vendor 'Acme Supplies' is on the approved-vendor list"),
                    RuleResult(rule_name="po_match", passed=True, detail="Matched PO PO-1001 (vendor: Acme Supplies, amount: $5,000.00)"),
                    RuleResult(rule_name="po_status_check", passed=True, detail="PO PO-1001 is open -- eligible for invoicing"),
                    RuleResult(rule_name="tolerance_check", passed=True, detail="Invoice $3,102.00 vs PO $5,000.00 -- within tolerance"),
                    RuleResult(rule_name="split_po_cumulative", passed=True, detail="Cumulative $3,102.00 within PO limit $5,100.00"),
                ],
            },
        },
        # Scenario 2: Flagged for Review (Amount Tolerance Overage)
        {
            "id": "inv-hist-flagged-tol",
            "vendor_name": "Sigma Consulting",
            "invoice_number": "INV-SIGMA-HIST-044",
            "invoice_date": "2026-09-20",
            "po_reference": "PO-1008",
            "subtotal": 9372.73,
            "tax": 937.27,
            "total": 10310.00,
            "source_file": "edge_case_3_near_tolerance.pdf",
            "confidence": {
                "vendor_name": 0.98,
                "invoice_number": 0.99,
                "invoice_date": 0.96,
                "po_reference": 0.95,
                "subtotal": 0.98,
                "tax": 0.95,
                "total": 0.99,
            },
            "extraction_method": "text",
            "line_items": [
                LineItem(description="Architecture Consulting Sprint", quantity=80, unit_price=117.16),
            ],
            "decision": {
                "status": "FLAGGED_FOR_REVIEW",
                "reason_code": "AMOUNT_OUT_OF_TOLERANCE",
                "reason_detail": "Invoice total $10,310.00 vs PO $10,000.00 (delta $310.00, tolerance $200.00) -- exceeds policy tolerance band.",
                "rules": [
                    RuleResult(rule_name="critical_field_check", passed=True, detail="All critical fields present with confidence >= 0.70"),
                    RuleResult(rule_name="arithmetic_check", passed=True, detail="Arithmetic verified: subtotal $9,372.73 + tax $937.27 = $10,310.00"),
                    RuleResult(rule_name="duplicate_check", passed=True, detail="No duplicate found for vendor 'Sigma Consulting' / invoice 'INV-SIGMA-HIST-044'"),
                    RuleResult(rule_name="approved_vendor_check", passed=True, detail="Vendor 'Sigma Consulting' is on approved list"),
                    RuleResult(rule_name="po_match", passed=True, detail="Matched PO PO-1008 (vendor: Sigma Consulting, amount: $10,000.00)"),
                    RuleResult(rule_name="po_status_check", passed=True, detail="PO PO-1008 is open"),
                    RuleResult(rule_name="tolerance_check", passed=False, detail="Invoice total $10,310.00 vs PO $10,000.00 (delta $310.00, tolerance $200.00) -- exceeds tolerance"),
                    RuleResult(rule_name="split_po_cumulative", passed=True, detail="Cumulative limit checked"),
                ],
            },
        },
        # Scenario 3: Flagged for Review (Low Confidence Scanned Image)
        {
            "id": "inv-hist-flagged-scan",
            "vendor_name": "Omega Freight (unverified)",
            "invoice_number": "INV-OF-HIST-099",
            "invoice_date": "2026-09-22",
            "po_reference": "PO-1009",
            "subtotal": 3850.00,
            "tax": 385.00,
            "total": 4235.00,
            "source_file": "edge_case_1_scanned_lowquality.pdf",
            "confidence": {
                "vendor_name": 0.45,   # LOW CONFIDENCE < 0.75
                "invoice_number": 0.50, # LOW CONFIDENCE < 0.75
                "invoice_date": 0.55,  # LOW CONFIDENCE < 0.75
                "po_reference": 0.60,  # LOW CONFIDENCE < 0.75
                "subtotal": 0.48,      # LOW CONFIDENCE < 0.75
                "tax": 0.45,           # LOW CONFIDENCE < 0.75
                "total": 0.40,         # LOW CONFIDENCE < 0.75
            },
            "extraction_method": "vision",
            "line_items": [
                LineItem(description="Freight services", quantity=10, unit_price=350.00),
                LineItem(description="Fuel surcharge", quantity=1, unit_price=350.00),
            ],
            "decision": {
                "status": "FLAGGED_FOR_REVIEW",
                "reason_code": "LOW_CONFIDENCE_EXTRACTION",
                "reason_detail": "Low-confidence extraction on vendor_name (0.45), total (0.40). Scanned document requires AP human inspection.",
                "rules": [
                    RuleResult(rule_name="critical_field_check", passed=False, detail="Low-confidence or noisy extraction on: vendor_name (0.45), total (0.40)"),
                    RuleResult(rule_name="arithmetic_check", passed=True, detail="Arithmetic checks completed"),
                    RuleResult(rule_name="duplicate_check", passed=True, detail="No duplicate identified"),
                    RuleResult(rule_name="approved_vendor_check", passed=True, detail="Vendor name tentatively matches Omega Freight"),
                    RuleResult(rule_name="po_match", passed=True, detail="Matched PO PO-1009"),
                    RuleResult(rule_name="po_status_check", passed=True, detail="PO is open"),
                    RuleResult(rule_name="tolerance_check", passed=True, detail="Within amount tolerance"),
                    RuleResult(rule_name="split_po_cumulative", passed=True, detail="Within cumulative limit"),
                ],
            },
        },
        # Scenario 4: Rejected (Fraud / Duplicate Submission)
        {
            "id": "inv-hist-rejected-dup",
            "vendor_name": "Acme Supplies",
            "invoice_number": "INV-ACME-HIST-001",
            "invoice_date": "2026-09-25",
            "po_reference": "PO-1001",
            "subtotal": 2820.00,
            "tax": 282.00,
            "total": 3102.00,
            "source_file": "edge_case_4_duplicate.pdf",
            "confidence": {
                "vendor_name": 0.98,
                "invoice_number": 0.99,
                "invoice_date": 0.97,
                "po_reference": 0.95,
                "subtotal": 0.99,
                "tax": 0.96,
                "total": 0.99,
            },
            "extraction_method": "text",
            "line_items": [
                LineItem(description="Office Chairs Model Ergonomic", quantity=10, unit_price=150.00),
                LineItem(description="Standing Desks Motorized", quantity=4, unit_price=330.00),
            ],
            "decision": {
                "status": "REJECTED",
                "reason_code": "DUPLICATE_INVOICE",
                "reason_detail": "Duplicate of invoice inv-hist-happy-01 (same vendor 'Acme Supplies' + invoice number 'INV-ACME-HIST-001') processed on 2026-09-15.",
                "rules": [
                    RuleResult(rule_name="critical_field_check", passed=True, detail="All critical fields present with confidence >= 0.70"),
                    RuleResult(rule_name="arithmetic_check", passed=True, detail="Arithmetic verified"),
                    RuleResult(rule_name="duplicate_check", passed=False, detail="Duplicate of invoice inv-hist-happy-01 processed on 2026-09-15"),
                    RuleResult(rule_name="approved_vendor_check", passed=True, detail="Vendor is approved"),
                    RuleResult(rule_name="po_match", passed=True, detail="Matched PO PO-1001"),
                    RuleResult(rule_name="po_status_check", passed=True, detail="PO is open"),
                    RuleResult(rule_name="tolerance_check", passed=True, detail="Tolerance within limits"),
                    RuleResult(rule_name="split_po_cumulative", passed=True, detail="Within cumulative limits"),
                ],
            },
        },
    ]

    for sc in scenarios:
        inv = Invoice(
            id=sc["id"],
            vendor_name=sc["vendor_name"],
            invoice_number=sc["invoice_number"],
            invoice_date=sc["invoice_date"],
            po_reference=sc["po_reference"],
            line_items=sc["line_items"],
            subtotal=sc["subtotal"],
            tax=sc["tax"],
            total=sc["total"],
            source_file=sc["source_file"],
            extraction_confidence=sc["confidence"],
            extraction_method=sc["extraction_method"],
        )
        upsert_invoice(inv)

        dec = Decision(
            invoice_id=sc["id"],
            status=sc["decision"]["status"],
            reason_code=sc["decision"]["reason_code"],
            reason_detail=sc["decision"]["reason_detail"],
            rules_evaluated=sc["decision"]["rules"],
            timestamp=now_iso,
        )
        upsert_decision(dec)

        # Upsert realistic run logs
        run_id = f"run-{sc['id']}"
        stages_info = [
            ("ingest", "complete", 85, f"File: {sc['source_file']}"),
            ("extract", "complete", 240, f"Method: {sc['extraction_method']}, confidence evaluated"),
            ("validate", "complete", 2, "Internal arithmetic verified"),
            ("match_po", "complete", 45, f"Matched PO: {sc['po_reference'] or 'None'}"),
            ("apply_rules", "complete", 1, "8 deterministic business rules evaluated"),
            ("decide", "complete", 5, f"{dec.status} — {dec.reason_code}"),
        ]
        for stage, status, dur, detail in stages_info:
            upsert_run_log(RunLog(
                run_id=run_id,
                invoice_id=sc["id"],
                stage=stage,
                stage_status=status,
                duration_ms=dur,
                detail=detail,
                timestamp=now_iso,
            ))

        # Copy test file to uploads so PDF viewer works immediately
        src_pdf = os.path.join(TEST_DATA_DIR, sc["source_file"])
        dst_pdf = os.path.join(UPLOAD_DIR, f"{sc['id']}.pdf")
        if os.path.exists(src_pdf):
            shutil.copyfile(src_pdf, dst_pdf)

        print(f"  [OK] Seeded Invoice {sc['id']} ({dec.status} - {sc['vendor_name']})")

    print(f"\nSeeded {len(scenarios)} historical invoices.")


def main() -> None:
    init_db()
    seed_purchase_orders()
    seed_historical_invoices()


if __name__ == "__main__":
    main()
