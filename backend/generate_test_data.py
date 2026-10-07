"""
generate_test_data.py
=====================
Generates the full test-data suite for the Invoice-to-Decision Engine:

  • 6 happy-path invoices (clean digital-text PDFs)
  • 4 edge-case fixtures:
      edge_case_1_scanned_lowquality  — rasterised image PDF (vision path)
      edge_case_2_split_po_a          — first of a split-PO pair (should approve)
      edge_case_2_split_po_b          — second of a split-PO pair (should flag cumulative)
      edge_case_3_near_tolerance      — amount just outside the 2% band
      edge_case_4_duplicate           — same invoice submitted twice

Run:
    python generate_test_data.py

Output:
    backend/test_data/*.pdf          — all invoice PDFs
    backend/seed_pos.json            — PO dataset imported by seed_database.py
"""

from __future__ import annotations

import json
import os
import random
import sys

# ── fpdf2 ──────────────────────────────────────────────────────────────────
from fpdf import FPDF
from fpdf.enums import XPos, YPos

# ── Pillow (for rasterising to image-only PDF) ─────────────────────────────
from PIL import Image, ImageDraw, ImageFont, ImageFilter

OUT_DIR = os.path.join(os.path.dirname(__file__), "test_data")
os.makedirs(OUT_DIR, exist_ok=True)


# ─────────────────────────────────────────────────────────────────────────────
# Purchase-Order dataset (referenced by invoices below)
# ─────────────────────────────────────────────────────────────────────────────

POS = [
    {"po_id": "PO-1001", "vendor_name": "Acme Supplies",    "po_amount": 5000.00,  "po_date": "2026-09-01", "status": "open"},
    {"po_id": "PO-1002", "vendor_name": "Beta Components",  "po_amount": 12000.00, "po_date": "2026-09-05", "status": "open"},
    {"po_id": "PO-1003", "vendor_name": "CloudHost Ltd",    "po_amount": 3500.00,  "po_date": "2026-09-10", "status": "open"},
    {"po_id": "PO-1004", "vendor_name": "Delta Logistics",  "po_amount": 8750.00,  "po_date": "2026-09-12", "status": "open"},
    {"po_id": "PO-1005", "vendor_name": "Epsilon Software",  "po_amount": 15000.00, "po_date": "2026-09-15", "status": "open"},
    {"po_id": "PO-1006", "vendor_name": "Apex Office",      "po_amount": 2200.00,  "po_date": "2026-09-18", "status": "open"},
    # Split-PO: two invoices will hit this one
    {"po_id": "PO-1007", "vendor_name": "Gamma Hardware",   "po_amount": 6000.00,  "po_date": "2026-09-20", "status": "open"},
    # Near-tolerance PO
    {"po_id": "PO-1008", "vendor_name": "Sigma Consulting",  "po_amount": 10000.00, "po_date": "2026-09-22", "status": "open"},
    # Scanned invoice PO
    {"po_id": "PO-1009", "vendor_name": "Omega Freight",    "po_amount": 4200.00,  "po_date": "2026-09-25", "status": "open"},
    # Extra POs for richness
    {"po_id": "PO-1010", "vendor_name": "Nova Materials",   "po_amount": 7300.00,  "po_date": "2026-09-28", "status": "open"},
]


# ─────────────────────────────────────────────────────────────────────────────
# PDF helper — clean digital-text invoice
# ─────────────────────────────────────────────────────────────────────────────

class InvoicePDF(FPDF):
    """Minimal but realistic invoice layout."""

    def header(self):
        self.set_font("Helvetica", "B", 18)
        self.set_fill_color(30, 58, 138)   # deep-blue header
        self.set_text_color(255, 255, 255)
        self.cell(0, 14, "  TAX INVOICE", new_x=XPos.LMARGIN, new_y=YPos.NEXT, fill=True)
        self.ln(2)
        self.set_text_color(0, 0, 0)

    def footer(self):
        self.set_y(-12)
        self.set_font("Helvetica", "I", 8)
        self.set_text_color(120, 120, 120)
        self.cell(0, 10, f"Page {self.page_no()}", align="C")


def build_invoice_pdf(
    filename: str,
    vendor: str,
    invoice_number: str,
    invoice_date: str,
    po_reference: str | None,
    line_items: list[dict],   # [{description, quantity, unit_price}]
    tax_rate: float = 0.10,
) -> str:
    """Write a clean-text PDF invoice; return its absolute path."""
    pdf = InvoicePDF()
    pdf.add_page()
    pdf.set_auto_page_break(auto=True, margin=15)

    # ── Vendor & invoice meta ────────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(95, 7, f"Vendor: {vendor}", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(0, 7, f"Invoice No: {invoice_number}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.set_font("Helvetica", "", 10)
    pdf.cell(95, 6, "", new_x=XPos.RIGHT, new_y=YPos.TOP)
    pdf.cell(0, 6, f"Date: {invoice_date}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    if po_reference:
        pdf.cell(95, 6, "", new_x=XPos.RIGHT, new_y=YPos.TOP)
        pdf.cell(0, 6, f"PO Reference: {po_reference}", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    pdf.ln(6)

    # ── Line-items table header ──────────────────────────────────────────────
    pdf.set_font("Helvetica", "B", 10)
    pdf.set_fill_color(220, 230, 255)
    pdf.cell(90, 8, "Description", border=1, fill=True)
    pdf.cell(25, 8, "Qty", border=1, fill=True, align="C")
    pdf.cell(35, 8, "Unit Price", border=1, fill=True, align="R")
    pdf.cell(40, 8, "Amount", border=1, fill=True, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Line items ────────────────────────────────────────────────────────────
    pdf.set_font("Helvetica", "", 10)
    subtotal = 0.0
    for item in line_items:
        amount = round(item["quantity"] * item["unit_price"], 2)
        subtotal += amount
        pdf.cell(90, 7, item["description"], border=1)
        pdf.cell(25, 7, str(item["quantity"]), border=1, align="C")
        pdf.cell(35, 7, f"${item['unit_price']:.2f}", border=1, align="R")
        pdf.cell(40, 7, f"${amount:.2f}", border=1, align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Totals ────────────────────────────────────────────────────────────────
    tax = round(subtotal * tax_rate, 2)
    total = round(subtotal + tax, 2)

    pdf.ln(3)
    pdf.set_font("Helvetica", "", 10)
    pdf.cell(150, 7, "Subtotal:", align="R")
    pdf.cell(40, 7, f"${subtotal:.2f}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.cell(150, 7, f"Tax ({int(tax_rate*100)}%):", align="R")
    pdf.cell(40, 7, f"${tax:.2f}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)
    pdf.set_font("Helvetica", "B", 11)
    pdf.cell(150, 8, "TOTAL:", align="R")
    pdf.cell(40, 8, f"${total:.2f}", align="R", new_x=XPos.LMARGIN, new_y=YPos.NEXT)

    # ── Payment terms ─────────────────────────────────────────────────────────
    pdf.ln(8)
    pdf.set_font("Helvetica", "I", 9)
    pdf.multi_cell(0, 5, "Payment terms: Net 30. Please remit to the bank account on file.")

    path = os.path.join(OUT_DIR, filename)
    pdf.output(path)
    return path


# ─────────────────────────────────────────────────────────────────────────────
# Scanned / image-only PDF (edge case 1)
# ─────────────────────────────────────────────────────────────────────────────

def build_scanned_invoice_pdf(filename: str) -> str:
    """
    Render an invoice to a Pillow image with simulated scan noise, then wrap it
    in a single-page image-only PDF so there is no extractable text layer.
    Uses reportlab to embed the image into a PDF.
    """
    # 1. Render text onto a white A4-ish canvas
    W, H = 794, 1123  # ~A4 at 96 dpi
    img = Image.new("L", (W, H), color=255)
    draw = ImageDraw.Draw(img)

    try:
        # Try a monospace font; fall back to default
        font_bold = ImageFont.truetype("cour.ttf", 22)
        font_reg  = ImageFont.truetype("cour.ttf", 18)
        font_sm   = ImageFont.truetype("cour.ttf", 14)
    except OSError:
        font_bold = ImageFont.load_default()
        font_reg  = font_bold
        font_sm   = font_bold

    y = 40
    def line(text: str, font=None, dy: int = 26) -> None:
        nonlocal y
        draw.text((60, y), text, font=font or font_reg, fill=0)
        y += dy

    line("TAX INVOICE", font=font_bold, dy=36)
    line("Vendor: Omega Freight")
    line("Invoice No: INV-SCAN-001")
    line("Date: 2026-09-30")
    line("PO Reference: PO-1009")
    line("")
    line("Description          Qty   Unit Price   Amount", font=font_sm)
    line("─" * 62, font=font_sm, dy=20)
    line("Freight services     10    $  350.00    $3500.00", font=font_sm)
    line("Fuel surcharge        1    $  350.00    $ 350.00", font=font_sm)
    line("─" * 62, font=font_sm, dy=20)
    line("Subtotal: $3850.00")
    line("Tax (10%): $ 385.00")
    line("TOTAL: $4235.00", font=font_bold)
    line("")
    line("Payment terms: Net 30.", font=font_sm)

    # 2. Add realistic scanner noise
    img = img.filter(ImageFilter.GaussianBlur(radius=0.6))
    # Salt-and-pepper noise
    import random as _r
    pixels = img.load()
    for _ in range(W * H // 40):
        x_ = _r.randint(0, W - 1)
        y_ = _r.randint(0, H - 1)
        pixels[x_, y_] = _r.choice([0, 255])

    # Slight rotation to mimic skew
    img = img.rotate(angle=0.8, fillcolor=255, expand=False)

    # 3. Save as PNG then embed in PDF via reportlab
    tmp_png = os.path.join(OUT_DIR, "_scan_tmp.png")
    img.save(tmp_png, "PNG")

    from reportlab.pdfgen import canvas as rl_canvas
    from reportlab.lib.pagesizes import A4

    pdf_path = os.path.join(OUT_DIR, filename)
    c = rl_canvas.Canvas(pdf_path, pagesize=A4)
    c.drawImage(tmp_png, 0, 0, width=A4[0], height=A4[1])
    c.save()
    os.remove(tmp_png)

    return pdf_path


# ─────────────────────────────────────────────────────────────────────────────
# Happy-path invoices
# ─────────────────────────────────────────────────────────────────────────────

HAPPY_PATH = [
    {
        "filename":       "happy_01_acme.pdf",
        "vendor":         "Acme Supplies",
        "invoice_number": "INV-ACME-2026-001",
        "invoice_date":   "2026-09-28",
        "po_reference":   "PO-1001",
        "line_items": [
            {"description": "Office paper reams",   "quantity": 20,  "unit_price": 18.00},
            {"description": "Stapler set",           "quantity": 5,   "unit_price": 22.00},
            {"description": "Printer toner (black)", "quantity": 10,  "unit_price": 235.00},
        ],
        "tax_rate": 0.10,
    },
    {
        "filename":       "happy_02_beta.pdf",
        "vendor":         "Beta Components",
        "invoice_number": "INV-BETA-2026-007",
        "invoice_date":   "2026-09-29",
        "po_reference":   "PO-1002",
        "line_items": [
            {"description": "Circuit boards (batch)",      "quantity": 50,  "unit_price": 120.00},
            {"description": "Resistor pack 10k",           "quantity": 200, "unit_price": 0.50},
            {"description": "Capacitor pack 100uF",        "quantity": 200, "unit_price": 0.30},
            {"description": "Micro-controller unit",       "quantity": 20,  "unit_price": 150.00},
        ],
        "tax_rate": 0.09,
    },
    {
        "filename":       "happy_03_cloudhost.pdf",
        "vendor":         "CloudHost Ltd",
        "invoice_number": "INV-CH-2026-1130",
        "invoice_date":   "2026-09-30",
        "po_reference":   "PO-1003",
        "line_items": [
            {"description": "Managed hosting (Sep 2026)", "quantity": 1, "unit_price": 2800.00},
            {"description": "SSL certificate renewal",    "quantity": 1, "unit_price": 200.00},
            {"description": "CDN bandwidth overage",      "quantity": 1, "unit_price": 181.82},  # ~3500/1.10
        ],
        "tax_rate": 0.10,
    },
    {
        "filename":       "happy_04_delta.pdf",
        "vendor":         "Delta Logistics",
        "invoice_number": "INV-DL-55821",
        "invoice_date":   "2026-10-01",
        "po_reference":   "PO-1004",
        "line_items": [
            {"description": "Freight - Zone A", "quantity": 5,  "unit_price": 700.00},
            {"description": "Freight - Zone B", "quantity": 3,  "unit_price": 600.00},
            {"description": "Fuel surcharge",   "quantity": 1,  "unit_price": 454.55},
        ],
        "tax_rate": 0.10,
    },
    {
        "filename":       "happy_05_epsilon.pdf",
        "vendor":         "Epsilon Software",
        "invoice_number": "INV-EPS-2026-Q4-001",
        "invoice_date":   "2026-10-01",
        "po_reference":   "PO-1005",
        "line_items": [
            {"description": "Enterprise licence (Q4 2026)", "quantity": 1,   "unit_price": 8000.00},
            {"description": "Professional services (hrs)", "quantity": 40,   "unit_price": 150.00},
            {"description": "Support tier upgrade",        "quantity": 1,    "unit_price": 2954.55},
        ],
        "tax_rate": 0.10,
    },
    {
        "filename":       "happy_06_apex.pdf",
        "vendor":         "Apex Office",
        "invoice_number": "INV-APX-0012",
        "invoice_date":   "2026-10-02",
        "po_reference":   "PO-1006",
        "line_items": [
            {"description": "Ergonomic chairs (x4)", "quantity": 4, "unit_price": 350.00},
            {"description": "Standing desk",          "quantity": 1, "unit_price": 600.00},
        ],
        "tax_rate": 0.10,
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Edge-case invoices
# ─────────────────────────────────────────────────────────────────────────────

EDGE_CASES_TEXT = [
    # Edge case 2a — first split-PO invoice (should auto-approve; 3000 < 6000)
    {
        "filename":       "edge_case_2_split_po_a.pdf",
        "vendor":         "Gamma Hardware",
        "invoice_number": "INV-GH-2026-A",
        "invoice_date":   "2026-10-01",
        "po_reference":   "PO-1007",
        "line_items": [
            {"description": "Server rack unit",    "quantity": 2, "unit_price": 1000.00},
            {"description": "Network switch 48-p", "quantity": 1, "unit_price": 727.27},
        ],
        "tax_rate": 0.10,
    },
    # Edge case 2b — second split-PO invoice pushes cumulative > PO amount
    # First invoice: 3000 total (already processed), this one: 3800
    # Cumulative = 6800 > 6000 → should flag
    {
        "filename":       "edge_case_2_split_po_b.pdf",
        "vendor":         "Gamma Hardware",
        "invoice_number": "INV-GH-2026-B",
        "invoice_date":   "2026-10-02",
        "po_reference":   "PO-1007",
        "line_items": [
            {"description": "SSD drives 2TB (x8)", "quantity": 10, "unit_price": 300.00},
            {"description": "Rack cabling set",    "quantity": 1,  "unit_price": 454.55},
        ],
        "tax_rate": 0.10,
    },
    # Edge case 3 — amount just outside 2% tolerance
    # PO: $10,000; invoice: $10,310 (3.1% over → outside 2% / $25 floor)
    {
        "filename":       "edge_case_3_near_tolerance.pdf",
        "vendor":         "Sigma Consulting",
        "invoice_number": "INV-SIG-2026-41",
        "invoice_date":   "2026-10-02",
        "po_reference":   "PO-1008",
        "line_items": [
            {"description": "Strategy consulting (hrs)", "quantity": 50, "unit_price": 150.00},
            {"description": "Market research report",   "quantity": 1,  "unit_price": 1872.73},
        ],
        "tax_rate": 0.10,
    },
    # Edge case 4 — duplicate of happy_01_acme
    {
        "filename":       "edge_case_4_duplicate.pdf",
        "vendor":         "Acme Supplies",
        "invoice_number": "INV-ACME-2026-001",   # same invoice number
        "invoice_date":   "2026-09-28",
        "po_reference":   "PO-1001",
        "line_items": [
            {"description": "Office paper reams",   "quantity": 20,  "unit_price": 18.00},
            {"description": "Stapler set",           "quantity": 5,   "unit_price": 22.00},
            {"description": "Printer toner (black)", "quantity": 10,  "unit_price": 235.00},
        ],
        "tax_rate": 0.10,
    },
]


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────

def main() -> None:
    print(f"Writing PDFs to {OUT_DIR}\n")

    # 1. Happy-path invoices
    for spec in HAPPY_PATH:
        build_invoice_pdf(**spec)
        print(f"  [OK]  {spec['filename']}")

    # 2. Edge cases (text-based)
    for spec in EDGE_CASES_TEXT:
        build_invoice_pdf(**spec)
        print(f"  [OK]  {spec['filename']}")

    # 3. Edge case 1 -- scanned image PDF
    build_scanned_invoice_pdf("edge_case_1_scanned_lowquality.pdf")
    print("  [OK]  edge_case_1_scanned_lowquality.pdf")

    # 4. Dump PO dataset
    po_path = os.path.join(os.path.dirname(__file__), "seed_pos.json")
    with open(po_path, "w") as f:
        json.dump(POS, f, indent=2)
    print(f"\n  [OK]  seed_pos.json ({len(POS)} POs)")

    print("\nAll test data generated successfully.")


if __name__ == "__main__":
    main()
