# =============================================================================
# config.py — All configurable thresholds and tunables for the Invoice Engine
# Business decisions live here, not scattered as magic numbers in logic files.
# =============================================================================

import os
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables from backend/.env or root .env
_backend_dir = Path(__file__).resolve().parent
load_dotenv(_backend_dir / ".env")
load_dotenv(_backend_dir.parent / ".env")


# ── Extraction ────────────────────────────────────────────────────────────────
# Minimum per-field confidence score (0–1) below which a critical field is
# considered unreliable and the invoice is flagged for manual review.
CONFIDENCE_THRESHOLD: float = 0.70

# Critical fields that must pass the confidence check.
CRITICAL_FIELDS: list[str] = ["vendor_name", "total", "invoice_number"]

# ── Arithmetic validation ─────────────────────────────────────────────────────
# Maximum rounding error ($) accepted when checking subtotal + tax = total
# and when verifying line-item amounts sum to the declared subtotal.
ARITHMETIC_TOLERANCE: float = 0.02

# ── Amount tolerance ──────────────────────────────────────────────────────────
# Acceptable delta between invoice total and PO amount.
# Rule: abs(invoice.total - po.po_amount) <= max(po.po_amount * TOLERANCE_PERCENT, TOLERANCE_FLOOR)
TOLERANCE_PERCENT: float = 0.02   # 2 % of the PO amount
TOLERANCE_FLOOR: float   = 25.00  # flat minimum tolerance in dollars

# ── Duplicate detection ───────────────────────────────────────────────────────
# How many days back to search for duplicate invoices.
# None = unbounded (scan entire history). Set an integer for a rolling window.
DUPLICATE_CHECK_WINDOW_DAYS: int | None = None

# ── Approved-vendor list ──────────────────────────────────────────────────────
# Only vendors on this list may receive payment.  Names are matched using the
# same fuzzy threshold (FUZZY_VENDOR_THRESHOLD) as PO matching, so minor
# abbreviation differences ("Acme Supplies Inc" vs "Acme Supplies") still pass.
# Add / remove vendors here; the rule engine picks up the change automatically.
APPROVED_VENDORS: list[str] = [
    "Acme Supplies",
    "Beta Components",
    "CloudHost Ltd",
    "Delta Logistics",
    "Epsilon Software",
    "Apex Office",
    "Gamma Hardware",
    "Sigma Consulting",
    "Omega Freight",
    "Nova Materials",
    "TechVision Distributors",
]

# ── PO fuzzy matching ─────────────────────────────────────────────────────────
# Vendor-name similarity threshold (0–1) for fuzzy PO matching when no explicit
# PO reference is present. Uses SequenceMatcher ratio.
FUZZY_VENDOR_THRESHOLD: float = 0.75

# Amount proximity tolerance used in fuzzy PO matching (fraction of PO amount).
FUZZY_AMOUNT_TOLERANCE: float = 0.10

# ── Mistral extraction ────────────────────────────────────────────────────────
# Model used for both text-native and vision-based invoice extraction.
MISTRAL_MODEL: str = "ministral-8b-latest"        # text / structured JSON path
MISTRAL_VISION_MODEL: str = "pixtral-12b-2409"    # vision / image path

# ── Database ──────────────────────────────────────────────────────────────────
DATABASE_PATH: str = "invoice_engine.db"

# ── Upload directory ──────────────────────────────────────────────────────────
UPLOAD_DIR: str = "uploads"

CORS_ORIGINS: list[str] = [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://localhost:3001",
    "http://127.0.0.1:3001",
    "http://localhost:5173",
    "http://localhost:8080",
]
