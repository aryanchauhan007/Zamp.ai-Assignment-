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
    upsert_run_log,
)
from models import (
    Decision,
    Invoice,
    InvoiceDetailResponse,
    InvoiceListItem,
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
