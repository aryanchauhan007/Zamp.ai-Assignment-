"""
main.py — FastAPI application for the Invoice-to-Decision Engine.
Implements the full API contract from the PRD.
"""

from __future__ import annotations

import asyncio
import json
import os
import shutil
import sys
import uuid
from typing import Optional

import aiofiles
from fastapi import BackgroundTasks, FastAPI, File, HTTPException, Query, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

sys.path.insert(0, os.path.dirname(__file__))

from config import CORS_ORIGINS, UPLOAD_DIR
from database import (
    get_decision,
    get_invoice,
    get_run_logs,
    init_db,
    list_invoices,
    list_pos,
    upsert_decision,
    upsert_run_log,
)
from models import (
    Decision,
    EmailWebhookRequest,
    Invoice,
    InvoiceDetailResponse,
    InvoiceListItem,
    OverrideRequest,
    RuleResult,
    RunLog,
    StatusResponse,
    UploadResponse,
)
from pipeline import STAGES, process_invoice

# ─────────────────────────────────────────────────────────────────────────────
# App bootstrap
# ─────────────────────────────────────────────────────────────────────────────

app = FastAPI(
    title="Invoice-to-Decision Engine",
    description="AI-powered AP invoice processing pipeline with explainable decisions.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_PATH = os.path.join(BASE_DIR, UPLOAD_DIR)
os.makedirs(UPLOAD_PATH, exist_ok=True)


@app.on_event("startup")
async def startup():
    init_db()
    try:
        from seed_database import seed_purchase_orders, seed_historical_invoices
        seed_purchase_orders()
        if len(list_invoices()) == 0:
            seed_historical_invoices()
    except Exception as e:
        print(f"Startup seed warning: {e}")



# ─────────────────────────────────────────────────────────────────────────────
# POST /api/invoices/upload
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/invoices/upload", response_model=UploadResponse)
async def upload_invoice(
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...),
):
    """Accept a PDF upload, save it, kick off async processing, return invoice_id."""
    if not file.filename or not file.filename.lower().endswith(".pdf"):
        raise HTTPException(status_code=400, detail="Only PDF files are accepted.")

    invoice_id = str(uuid.uuid4())
    dest_path  = os.path.join(UPLOAD_PATH, f"{invoice_id}.pdf")

    # Save uploaded file
    async with aiofiles.open(dest_path, "wb") as out:
        content = await file.read()
        await out.write(content)

    # Initialise all stages as pending immediately so polling works from t=0
    from datetime import datetime, timezone
    run_id = str(uuid.uuid4())
    now    = datetime.now(timezone.utc).isoformat()
    for stage in STAGES:
        upsert_run_log(RunLog(
            run_id=run_id,
            invoice_id=invoice_id,
            stage=stage,
            stage_status="pending",
            timestamp=now,
        ))

    # Launch pipeline as background task
    background_tasks.add_task(process_invoice, dest_path, invoice_id)

    return UploadResponse(invoice_id=invoice_id, message="Processing started.")


# ─────────────────────────────────────────────────────────────────────────────
# Test Cases & Demo Runner
# ─────────────────────────────────────────────────────────────────────────────

TEST_CASES = [
    {
        "id": "happy_path",
        "title": "Happy Path — Clean Invoice",
        "category": "happy",
        "subtitle": "Acme Supplies ($3,102.00 vs PO $5,000.00)",
        "filename": "happy_01_acme.pdf",
        "description": "Standard digital text PDF. Expected: AUTO_APPROVED with full audit trail.",
    },
    {
        "id": "edge_1",
        "title": "Edge Case 1 — Scanned / Low Quality",
        "category": "edge",
        "subtitle": "Omega Freight (noisy raster scan, vision path)",
        "filename": "edge_case_1_scanned_lowquality.pdf",
        "description": "Scanned image PDF with noise & skew. Routes to vision path; low confidence (<0.70) on critical fields flags for human review.",
    },
    {
        "id": "edge_2a",
        "title": "Edge Case 2a — Split PO (Delivery 1 of 2)",
        "category": "edge",
        "subtitle": "Gamma Hardware ($3,000.00 against PO $6,000.00)",
        "filename": "edge_case_2_split_po_a.pdf",
        "description": "First partial delivery against PO-1007. Expected: AUTO_APPROVED, cumulative invoiced tracks to $3,000.00.",
    },
    {
        "id": "edge_2b",
        "title": "Edge Case 2b — Split PO (Delivery 2: Over Limit)",
        "category": "edge",
        "subtitle": "Gamma Hardware ($3,800.00; total reaches $6,800.00)",
        "filename": "edge_case_2_split_po_b.pdf",
        "description": "Second delivery pushes cumulative to $6,800.01 > $6,000.00 (+tolerance $120). Expected: FLAGGED (Cumulative Exceeded).",
    },
    {
        "id": "edge_3",
        "title": "Edge Case 3 — Amount Just Outside Tolerance",
        "category": "edge",
        "subtitle": "Sigma Consulting ($10,310.00 vs PO $10,000.00)",
        "filename": "edge_case_3_near_tolerance.pdf",
        "description": "Over-billing by $310.00 exceeds the 2% / $200 tolerance band. Expected: FLAGGED with exact delta and threshold.",
    },
    {
        "id": "edge_4",
        "title": "Edge Case 4 — Duplicate Invoice",
        "category": "edge",
        "subtitle": "Acme Supplies (same invoice # INV-ACME-2026-001)",
        "filename": "edge_case_4_duplicate.pdf",
        "description": "Re-submission of an existing invoice. Fingerprinted by vendor + invoice #. Expected: REJECTED with reference to original.",
    },
]


@app.get("/api/test-cases")
async def list_test_cases():
    return TEST_CASES


@app.post("/api/test-cases/run", response_model=UploadResponse)
async def run_test_case(background_tasks: BackgroundTasks, case_id: str = Query(...)):
    tc = next((c for c in TEST_CASES if c["id"] == case_id), None)
    if not tc:
        raise HTTPException(status_code=404, detail="Test case not found.")

    src_path = os.path.join(BASE_DIR, "test_data", tc["filename"])
    if not os.path.isfile(src_path):
        raise HTTPException(status_code=404, detail=f"Test data file {tc['filename']} not found.")

    invoice_id = str(uuid.uuid4())
    dest_path = os.path.join(UPLOAD_PATH, f"{invoice_id}.pdf")
    shutil.copyfile(src_path, dest_path)

    from datetime import datetime, timezone
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    for stage in STAGES:
        upsert_run_log(RunLog(
            run_id=run_id,
            invoice_id=invoice_id,
            stage=stage,
            stage_status="pending",
            timestamp=now,
        ))

    background_tasks.add_task(process_invoice, dest_path, invoice_id)
    return UploadResponse(invoice_id=invoice_id, message=f"Started test case '{tc['title']}'.")


@app.post("/api/demo/reset")
async def reset_demo():
    from database import reset_demo_data
    reset_demo_data()
    return {"message": "Demo data reset successfully."}



# ─────────────────────────────────────────────────────────────────────────────
# GET /api/invoices/{id}/status  (polling endpoint)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/invoices/{invoice_id}/status", response_model=StatusResponse)
async def get_invoice_status(invoice_id: str):
    logs = get_run_logs(invoice_id)
    if not logs:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    # Build per-stage status map (latest entry per stage wins)
    stage_status: dict[str, str]        = {}
    stage_detail: dict[str, str | None] = {}
    for log in logs:
        stage_status[log.stage] = log.stage_status
        stage_detail[log.stage] = log.detail

    # Current stage = last stage that is 'running', else last 'complete'
    running = [s for s in STAGES if stage_status.get(s) == "running"]
    current = running[0] if running else next(
        (s for s in reversed(STAGES) if stage_status.get(s) == "complete"), STAGES[0]
    )

    is_complete = stage_status.get("decide") in ("complete", "failed")

    return StatusResponse(
        invoice_id=invoice_id,
        current_stage=current,
        stage_statuses=stage_status,
        stage_details=stage_detail,
        is_complete=is_complete,
    )


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/invoices/{id}
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/invoices/{invoice_id}", response_model=InvoiceDetailResponse)
async def get_invoice_detail(invoice_id: str):
    logs = get_run_logs(invoice_id)
    if not logs:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    invoice  = get_invoice(invoice_id)
    decision = get_decision(invoice_id)

    # Look up matched PO from decision trail if available
    matched_po = None
    if decision:
        import re
        from database import get_po
        for rule in decision.rules_evaluated:
            if rule.rule_name == "po_match" and rule.passed:
                m = re.search(r"Matched PO ([\w-]+)", rule.detail)
                if m:
                    matched_po = get_po(m.group(1))
                break

    return InvoiceDetailResponse(
        invoice=invoice,
        matched_po=matched_po,
        decision=decision,
        run_logs=logs,
    )


@app.get("/api/invoices/{invoice_id}/pdf")
async def get_invoice_pdf(invoice_id: str):
    """Serve the original invoice PDF for side-by-side inspection."""
    file_path = os.path.join(UPLOAD_PATH, f"{invoice_id}.pdf")
    if not os.path.isfile(file_path):
        inv = get_invoice(invoice_id)
        if inv and inv.source_file:
            alt_test = os.path.join(BASE_DIR, "test_data", inv.source_file)
            if os.path.isfile(alt_test):
                file_path = alt_test
            else:
                alt_sample = os.path.join(os.path.dirname(BASE_DIR), "sample_invoices", inv.source_file)
                if os.path.isfile(alt_sample):
                    file_path = alt_sample

    if not os.path.isfile(file_path):
        raise HTTPException(status_code=404, detail="Invoice PDF not found.")

    return FileResponse(
        file_path,
        media_type="application/pdf",
        headers={"Content-Disposition": f"inline; filename={invoice_id}.pdf"},
    )


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/invoices/{id}/override — Human-in-the-Loop (HITL) Override
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/invoices/{invoice_id}/override", response_model=InvoiceDetailResponse)
async def override_invoice_decision(invoice_id: str, req: OverrideRequest):
    """
    Allow AP Managers to review flagged invoices and manually force-approve or
    force-reject with an auditable justification.
    """
    inv = get_invoice(invoice_id)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found.")

    dec = get_decision(invoice_id)
    if not dec:
        raise HTTPException(status_code=404, detail="Decision not found.")

    clean_reason = req.reason.strip()
    if not clean_reason:
        raise HTTPException(status_code=400, detail="A mandatory justification reason is required for human override.")

    target_status = "AUTO_APPROVED" if req.decision.upper() in ("APPROVED", "AUTO_APPROVED") else "REJECTED"
    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()

    # Append human override rule to evaluated trail
    override_rule = RuleResult(
        rule_name="human_in_the_loop_override",
        passed=(target_status == "AUTO_APPROVED"),
        detail=f"AP Manager manual override to {target_status}: {clean_reason}",
    )
    updated_rules = dec.rules_evaluated + [override_rule]

    new_dec = Decision(
        invoice_id=invoice_id,
        status=target_status,
        reason_code="MANUAL_OVERRIDE",
        reason_detail=f"Manually overridden by AP Manager ({target_status}): {clean_reason}",
        rules_evaluated=updated_rules,
        timestamp=now_iso,
    )
    upsert_decision(new_dec)

    # Append audit run log
    upsert_run_log(RunLog(
        run_id=str(uuid.uuid4()),
        invoice_id=invoice_id,
        stage="override",
        stage_status="complete",
        duration_ms=0,
        detail=f"Human override to {target_status} -- Justification: {clean_reason}",
        timestamp=now_iso,
    ))

    return await get_invoice_detail(invoice_id)


# ─────────────────────────────────────────────────────────────────────────────
# POST /api/webhooks/email-ingest — Real-World Email Ingestion Webhook
# ─────────────────────────────────────────────────────────────────────────────

@app.post("/api/webhooks/email-ingest", status_code=202)
async def email_webhook_ingest(background_tasks: BackgroundTasks, payload: EmailWebhookRequest):
    """
    Simulate SendGrid Inbound Parse / Parseur email webhook ingestion.
    Accepts incoming email metadata and invoice PDF payload, queuing automated background processing.
    """
    invoice_id = str(uuid.uuid4())
    dest_path = os.path.join(UPLOAD_PATH, f"{invoice_id}.pdf")

    # If base64 payload provided, decode to PDF
    if payload.pdf_base64:
        import base64
        try:
            raw_b64 = payload.pdf_base64
            if "," in raw_b64:
                raw_b64 = raw_b64.split(",", 1)[1]
            pdf_bytes = base64.b64decode(raw_b64)
            with open(dest_path, "wb") as f:
                f.write(pdf_bytes)
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"Invalid base64 PDF payload: {e}")
    else:
        # Default sample invoice from incoming email simulation
        sample_file = os.path.join(BASE_DIR, "test_data", "happy_01_acme.pdf")
        if payload.pdf_url:
            candidate = os.path.join(BASE_DIR, "test_data", payload.pdf_url)
            if os.path.isfile(candidate):
                sample_file = candidate
            elif os.path.isfile(payload.pdf_url):
                sample_file = payload.pdf_url
        if not os.path.isfile(sample_file):
            alt_sample = os.path.join(os.path.dirname(BASE_DIR), "sample_invoices", "invoice_51109301.pdf")
            if os.path.isfile(alt_sample):
                sample_file = alt_sample
        shutil.copyfile(sample_file, dest_path)

    from datetime import datetime, timezone
    now_iso = datetime.now(timezone.utc).isoformat()
    run_id = str(uuid.uuid4())

    for stage in STAGES:
        upsert_run_log(RunLog(
            run_id=run_id,
            invoice_id=invoice_id,
            stage=stage,
            stage_status="pending",
            timestamp=now_iso,
        ))

    # Record email ingest receipt log
    upsert_run_log(RunLog(
        run_id=run_id,
        invoice_id=invoice_id,
        stage="ingest",
        stage_status="running",
        duration_ms=0,
        detail=f"Inbound Email from {payload.sender} — Subject: '{payload.subject}'",
        timestamp=now_iso,
    ))

    background_tasks.add_task(process_invoice, dest_path, invoice_id)

    return {
        "status": "accepted",
        "invoice_id": invoice_id,
        "sender": payload.sender,
        "subject": payload.subject,
        "message": "Email invoice accepted and queued for automated processing pipeline.",
    }




# ─────────────────────────────────────────────────────────────────────────────
# GET /api/invoices  (dashboard list)
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/invoices", response_model=list[InvoiceListItem])
async def list_all_invoices(status: Optional[str] = Query(None)):
    rows = list_invoices()
    items = [
        InvoiceListItem(
            invoice_id=r["id"],
            vendor_name=r["vendor_name"],
            invoice_number=r["invoice_number"],
            total=r["total"],
            status=r["status"],
            timestamp=r["timestamp"],
            source_file=r["source_file"],
        )
        for r in rows
    ]
    if status:
        items = [i for i in items if i.status == status.upper()]
    return items


# ─────────────────────────────────────────────────────────────────────────────
# GET /api/pos
# ─────────────────────────────────────────────────────────────────────────────

@app.get("/api/pos")
async def get_pos():
    return list_pos()


# ─────────────────────────────────────────────────────────────────────────────
# Serve frontend (if built)
# ─────────────────────────────────────────────────────────────────────────────

frontend_dist = os.path.join(os.path.dirname(BASE_DIR), "frontend", "dist")
frontend_dir = frontend_dist if os.path.isdir(frontend_dist) else os.path.join(os.path.dirname(BASE_DIR), "frontend")
if os.path.isdir(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="static")
