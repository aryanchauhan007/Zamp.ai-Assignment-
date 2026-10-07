"""
models.py — Pydantic data models for the Invoice-to-Decision Engine.
These are the canonical data shapes shared across extraction, rules engine, and API.
"""

from __future__ import annotations

from typing import Literal
from pydantic import BaseModel, Field


# ─────────────────────────────────────────────────────────────────────────────
# Core invoice structures
# ─────────────────────────────────────────────────────────────────────────────

class LineItem(BaseModel):
    description: str
    quantity: float
    unit_price: float

    @property
    def line_total(self) -> float:
        return round(self.quantity * self.unit_price, 2)


class Invoice(BaseModel):
    id: str
    vendor_name: str
    invoice_number: str
    invoice_date: str
    po_reference: str | None = None
    line_items: list[LineItem] = Field(default_factory=list)
    subtotal: float
    tax: float
    total: float
    source_file: str
    # Per-field confidence scores, 0–1 (populated by extraction module)
    extraction_confidence: dict[str, float] = Field(default_factory=dict)
    extraction_method: Literal["text", "vision"]


# ─────────────────────────────────────────────────────────────────────────────
# Purchase Order
# ─────────────────────────────────────────────────────────────────────────────

class PurchaseOrder(BaseModel):
    po_id: str
    vendor_name: str
    po_amount: float
    po_date: str
    status: str  # "open", "closed", "partially_fulfilled"
    cumulative_invoiced: float = 0.0


# ─────────────────────────────────────────────────────────────────────────────
# Decision & Rules
# ─────────────────────────────────────────────────────────────────────────────

class RuleResult(BaseModel):
    rule_name: str
    passed: bool
    detail: str


class Decision(BaseModel):
    invoice_id: str
    status: Literal["AUTO_APPROVED", "FLAGGED_FOR_REVIEW", "REJECTED"]
    reason_code: str
    reason_detail: str
    rules_evaluated: list[RuleResult] = Field(default_factory=list)
    timestamp: str


# ─────────────────────────────────────────────────────────────────────────────
# Run Log (powers the live-run view)
# ─────────────────────────────────────────────────────────────────────────────

class RunLog(BaseModel):
    run_id: str
    invoice_id: str
    stage: Literal["ingest", "extract", "validate", "match_po", "apply_rules", "decide"]
    stage_status: Literal["pending", "running", "complete", "failed"]
    duration_ms: int | None = None
    detail: str | None = None
    timestamp: str


# ─────────────────────────────────────────────────────────────────────────────
# API response shapes
# ─────────────────────────────────────────────────────────────────────────────

class UploadResponse(BaseModel):
    invoice_id: str
    message: str


class StatusResponse(BaseModel):
    invoice_id: str
    current_stage: str
    stage_statuses: dict[str, str]   # stage → status
    stage_details: dict[str, str | None]
    is_complete: bool


class InvoiceDetailResponse(BaseModel):
    invoice: Invoice | None
    matched_po: PurchaseOrder | None
    decision: Decision | None
    run_logs: list[RunLog]


class InvoiceListItem(BaseModel):
    invoice_id: str
    vendor_name: str
    invoice_number: str
    total: float
    status: str | None
    timestamp: str | None
    source_file: str
