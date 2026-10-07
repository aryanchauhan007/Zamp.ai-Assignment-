"""
database.py — SQLite persistence layer for the Invoice Engine.
Creates tables, provides CRUD helpers for all four core entities.
"""

from __future__ import annotations

import json
import sqlite3
import os
from contextlib import contextmanager
from typing import Generator

import sys
sys.path.insert(0, os.path.dirname(__file__))

from config import DATABASE_PATH
from models import Invoice, PurchaseOrder, Decision, RunLog


# ─────────────────────────────────────────────────────────────────────────────
# Connection factory
# ─────────────────────────────────────────────────────────────────────────────

def get_db_path() -> str:
    """Return absolute DB path so it's stable regardless of cwd."""
    base = os.path.dirname(os.path.abspath(__file__))
    return os.path.join(base, DATABASE_PATH)


@contextmanager
def get_conn() -> Generator[sqlite3.Connection, None, None]:
    conn = sqlite3.connect(get_db_path(), check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


# ─────────────────────────────────────────────────────────────────────────────
# Schema initialization
# ─────────────────────────────────────────────────────────────────────────────

DDL = """
CREATE TABLE IF NOT EXISTS invoices (
    id                      TEXT PRIMARY KEY,
    vendor_name             TEXT NOT NULL,
    invoice_number          TEXT NOT NULL,
    invoice_date            TEXT NOT NULL,
    po_reference            TEXT,
    line_items              TEXT NOT NULL,   -- JSON
    subtotal                REAL NOT NULL,
    tax                     REAL NOT NULL,
    total                   REAL NOT NULL,
    source_file             TEXT NOT NULL,
    extraction_confidence   TEXT NOT NULL,   -- JSON
    extraction_method       TEXT NOT NULL,
    created_at              TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS purchase_orders (
    po_id               TEXT PRIMARY KEY,
    vendor_name         TEXT NOT NULL,
    po_amount           REAL NOT NULL,
    po_date             TEXT NOT NULL,
    status              TEXT NOT NULL,
    cumulative_invoiced REAL NOT NULL DEFAULT 0.0
);

CREATE TABLE IF NOT EXISTS decisions (
    invoice_id      TEXT PRIMARY KEY,
    status          TEXT NOT NULL,
    reason_code     TEXT NOT NULL,
    reason_detail   TEXT NOT NULL,
    rules_evaluated TEXT NOT NULL,  -- JSON
    timestamp       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS run_logs (
    run_id          TEXT NOT NULL,
    invoice_id      TEXT NOT NULL,
    stage           TEXT NOT NULL,
    stage_status    TEXT NOT NULL,
    duration_ms     INTEGER,
    detail          TEXT,
    timestamp       TEXT NOT NULL,
    PRIMARY KEY (run_id, stage)
);

CREATE INDEX IF NOT EXISTS idx_run_logs_invoice ON run_logs(invoice_id);
CREATE INDEX IF NOT EXISTS idx_decisions_status ON decisions(status);
"""


def init_db() -> None:
    """Create all tables if they don't exist yet."""
    with get_conn() as conn:
        conn.executescript(DDL)


# ─────────────────────────────────────────────────────────────────────────────
# Invoice CRUD
# ─────────────────────────────────────────────────────────────────────────────

def upsert_invoice(inv: Invoice) -> None:
    sql = """
    INSERT OR REPLACE INTO invoices
        (id, vendor_name, invoice_number, invoice_date, po_reference,
         line_items, subtotal, tax, total, source_file,
         extraction_confidence, extraction_method)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
    """
    with get_conn() as conn:
        conn.execute(sql, (
            inv.id, inv.vendor_name, inv.invoice_number, inv.invoice_date,
            inv.po_reference,
            json.dumps([li.dict() for li in inv.line_items]),
            inv.subtotal, inv.tax, inv.total, inv.source_file,
            json.dumps(inv.extraction_confidence),
            inv.extraction_method,
        ))


def get_invoice(invoice_id: str) -> Invoice | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM invoices WHERE id = ?", (invoice_id,)
        ).fetchone()
    if row is None:
        return None
    return _row_to_invoice(row)


def list_invoices() -> list[dict]:
    """Return light summary rows for the dashboard list."""
    sql = """
    SELECT i.id, i.vendor_name, i.invoice_number, i.total, i.source_file,
           d.status, d.timestamp
    FROM invoices i
    LEFT JOIN decisions d ON d.invoice_id = i.id
    ORDER BY d.timestamp DESC NULLS LAST
    """
    with get_conn() as conn:
        rows = conn.execute(sql).fetchall()
    return [dict(r) for r in rows]


def _row_to_invoice(row: sqlite3.Row) -> Invoice:
    from models import LineItem
    data = dict(row)
    data["line_items"] = [LineItem(**li) for li in json.loads(data["line_items"])]
    data["extraction_confidence"] = json.loads(data["extraction_confidence"])
    # Drop DB-only columns not in the Pydantic model
    data.pop("created_at", None)
    return Invoice(**data)


# ─────────────────────────────────────────────────────────────────────────────
# Purchase Order CRUD
# ─────────────────────────────────────────────────────────────────────────────

def upsert_po(po: PurchaseOrder) -> None:
    sql = """
    INSERT OR REPLACE INTO purchase_orders
        (po_id, vendor_name, po_amount, po_date, status, cumulative_invoiced)
    VALUES (?,?,?,?,?,?)
    """
    with get_conn() as conn:
        conn.execute(sql, (
            po.po_id, po.vendor_name, po.po_amount, po.po_date,
            po.status, po.cumulative_invoiced,
        ))


def get_po(po_id: str) -> PurchaseOrder | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM purchase_orders WHERE po_id = ?", (po_id,)
        ).fetchone()
    return PurchaseOrder(**dict(row)) if row else None


def list_pos() -> list[dict]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM purchase_orders").fetchall()
    return [dict(r) for r in rows]


def update_po_cumulative(po_id: str, delta: float) -> None:
    """Atomically add *delta* to the PO's cumulative_invoiced."""
    with get_conn() as conn:
        conn.execute(
            "UPDATE purchase_orders SET cumulative_invoiced = cumulative_invoiced + ? WHERE po_id = ?",
            (delta, po_id),
        )


def get_all_pos() -> list[PurchaseOrder]:
    with get_conn() as conn:
        rows = conn.execute("SELECT * FROM purchase_orders").fetchall()
    return [PurchaseOrder(**dict(r)) for r in rows]


# ─────────────────────────────────────────────────────────────────────────────
# Decision CRUD
# ─────────────────────────────────────────────────────────────────────────────

def upsert_decision(dec: Decision) -> None:
    sql = """
    INSERT OR REPLACE INTO decisions
        (invoice_id, status, reason_code, reason_detail, rules_evaluated, timestamp)
    VALUES (?,?,?,?,?,?)
    """
    with get_conn() as conn:
        conn.execute(sql, (
            dec.invoice_id, dec.status, dec.reason_code, dec.reason_detail,
            json.dumps([r.dict() for r in dec.rules_evaluated]),
            dec.timestamp,
        ))


def get_decision(invoice_id: str) -> Decision | None:
    with get_conn() as conn:
        row = conn.execute(
            "SELECT * FROM decisions WHERE invoice_id = ?", (invoice_id,)
        ).fetchone()
    if row is None:
        return None
    from models import RuleResult
    data = dict(row)
    data["rules_evaluated"] = [RuleResult(**r) for r in json.loads(data["rules_evaluated"])]
    return Decision(**data)


# ─────────────────────────────────────────────────────────────────────────────
# Run Log CRUD
# ─────────────────────────────────────────────────────────────────────────────

def upsert_run_log(log: RunLog) -> None:
    sql = """
    INSERT OR REPLACE INTO run_logs
        (run_id, invoice_id, stage, stage_status, duration_ms, detail, timestamp)
    VALUES (?,?,?,?,?,?,?)
    """
    with get_conn() as conn:
        conn.execute(sql, (
            log.run_id, log.invoice_id, log.stage, log.stage_status,
            log.duration_ms, log.detail, log.timestamp,
        ))


def get_run_logs(invoice_id: str) -> list[RunLog]:
    with get_conn() as conn:
        rows = conn.execute(
            "SELECT * FROM run_logs WHERE invoice_id = ? ORDER BY timestamp",
            (invoice_id,),
        ).fetchall()
    return [RunLog(**dict(r)) for r in rows]


def find_duplicate(vendor_name: str, invoice_number: str,
                   amount: float, date: str,
                   exclude_id: str | None = None) -> str | None:
    """
    Return the invoice_id of an existing invoice that matches either:
      (a) same vendor_name + invoice_number, OR
      (b) same vendor_name + total + invoice_date
    Returns None if no duplicate found.
    """
    with get_conn() as conn:
        params_a: list = [vendor_name, invoice_number]
        clause_a = "vendor_name = ? AND invoice_number = ?"
        params_b: list = [vendor_name, amount, date]
        clause_b = "vendor_name = ? AND total = ? AND invoice_date = ?"

        exclude_clause = ""
        if exclude_id:
            exclude_clause = " AND id != ?"
            params_a.append(exclude_id)
            params_b.append(exclude_id)

        for clause, params in [(clause_a, params_a), (clause_b, params_b)]:
            row = conn.execute(
                f"SELECT id FROM invoices WHERE {clause}{exclude_clause} LIMIT 1",
                params,
            ).fetchone()
            if row:
                return row["id"]
    return None


def reset_demo_data() -> None:
    """Clear all invoice runs, decisions, and run logs, and reset PO cumulatives to 0."""
    with get_conn() as conn:
        conn.execute("DELETE FROM decisions")
        conn.execute("DELETE FROM invoices")
        conn.execute("DELETE FROM run_logs")
        conn.execute("UPDATE purchase_orders SET cumulative_invoiced = 0.0")

