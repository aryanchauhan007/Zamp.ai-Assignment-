"""
seed_database.py — Seed the SQLite database with PO data from seed_pos.json.
Run AFTER generate_test_data.py.

Usage:
    python backend/seed_database.py
"""

from __future__ import annotations

import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import init_db, upsert_po
from models import PurchaseOrder

def main() -> None:
    init_db()

    seed_file = os.path.join(os.path.dirname(__file__), "seed_pos.json")
    if not os.path.exists(seed_file):
        print(f"ERROR: {seed_file} not found. Run generate_test_data.py first.")
        sys.exit(1)

    with open(seed_file) as f:
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
        print(f"  [OK]  {po.po_id}  {po.vendor_name}  ${po.po_amount:,.2f}")

    print(f"\nSeeded {len(pos_data)} purchase orders.")


if __name__ == "__main__":
    main()
