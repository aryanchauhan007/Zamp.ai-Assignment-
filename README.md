# Invoice-to-Decision Engine

An AI-powered accounts-payable invoice processing pipeline with explainable business-rule decisions.

Built for **Zamp AI Solutions** case study — PS-1 (Finance/AP).

---

## Quick Start

### 1. Backend (FastAPI + SQLite + Rules Engine)
```bash
cd backend
pip install -r requirements.txt

# (Optional: set Mistral API key if using cloud extraction; otherwise local fallback runs automatically)
# set MISTRAL_API_KEY=your_key_here

# Generate synthetic invoices + seed PO database
python generate_test_data.py
python seed_database.py

# Start FastAPI server (runs on port 8000)
python -m uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```
Interactive API docs: `http://localhost:8000/docs`

### 2. Frontend (Next.js + TypeScript + Vanilla CSS)
```bash
cd frontend
npm install
npm run dev -- -p 3001
```
Open **`http://localhost:3001`** in your browser.

> **Note on Frontend Architecture:** Built in Next.js per request. It runs as a lightweight, zero-SSR client application with Next.js App Router. Because it is completely decoupled from the FastAPI backend, it can also be built as a static bundle (`npm run build`) or ported to Vite without altering a single line of backend logic.

---

## Architecture & Integration Details

### Frontend Proxy Configuration
All `/api/*` requests in the Next.js frontend are proxied to the FastAPI backend via `frontend/next.config.ts`:
```ts
// frontend/next.config.ts
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://127.0.0.1:8000/api/:path*",
      },
    ];
  },
};

export default nextConfig;
```
Direct cross-origin requests to `http://127.0.0.1:8000/api/...` are also supported through FastAPI CORS middleware configured in `backend/config.py`.

---

## Design System Tokens

The application uses a pure Vanilla CSS token system located in [`frontend/styles/tokens.css`](file:///d:/InvoiceTracker(Zapp.ai)/frontend/styles/tokens.css):

| Category | Token Name | Value | Purpose |
|---|---|---|---|
| **Background** | `--bg-dark` | `#090d16` | Main application backdrop |
| **Surfaces** | `--bg-card` | `rgba(16, 23, 41, 0.88)` | Primary glassmorphism card background |
| | `--bg-card-subtle` | `rgba(22, 32, 57, 0.65)` | Sub-panels & inner tables |
| | `--bg-card-hover` | `rgba(26, 38, 68, 0.95)` | Interactive row hover |
| **Borders** | `--border` | `rgba(255, 255, 255, 0.08)` | Subtle card borders |
| | `--border-light` | `rgba(255, 255, 255, 0.14)` | Hover card borders |
| | `--border-focus` | `#38bdf8` | Focused inputs |
| **Text / Ink** | `--text-main` | `#f8fafc` | High-contrast headers and values |
| | `--text-muted` | `#94a3b8` | Subtitles and explanatory copy |
| | `--text-dim` | `#64748b` | Field labels and metadata |
| **Accents** | `--accent-blue` | `#38bdf8` | Active stage indicator, primary accents |
| | `--accent-purple` | `#818cf8` | Secondary test case launcher accent |
| **States** | `--approved` | `#10b981` | Auto-approved verdict & passed checks |
| | `--flagged` | `#f59e0b` | Flagged for review & tolerance overages |
| | `--rejected` | `#ef4444` | Rejected verdict & duplicate alerts |
| | `--pending` | `#64748b` | Unreached pipeline stages |

---

## 5-State User Journey (Demo Flow)

### State 1: First Visit — Empty State
* **Experience**: User lands on a clean welcome screen with an executive description and one primary CTA button: `"Run an Invoice"`.
* **Zero Fabricated Stats**: No empty tables, no "No data" placeholders, and no artificial zeros.
* **"Reset Demo Data" Endpoint**:
  * Calls `POST /api/demo/reset` on the backend.
  * Clears SQLite tables (`invoices`, `decisions`, `run_logs`) and resets `cumulative_invoiced` to `$0.00` on all purchase orders.
  * Allows the presenter to reset the app back to this clean state with one click during an interview.

### State 2: Starting a Run (Dual Entry Points)
* Both options are visible side-by-side:
  1. **Upload a File**: Real drag-and-drop file picker accepting vendor invoice PDFs.
  2. **Run a Test Case**: Pre-built one-click launcher for Happy Path and all 4 Edge Cases (no file-picker friction during live demos).
* **Single-Flight Concurrency Lock**: While an invoice is processing (`isProcessing = true`), both the quick-run buttons and upload trigger are locked out to prevent parallel run race conditions during a live presentation.

### State 3: Live Run Panel (Processing)
* Appears immediately at the top of the dashboard without losing page context.
* **6-Stage Stepper**: `Ingest` → `Extract` → `Validate` → `Match PO` → `Apply Rules` → `Decision`.
* **Polling Cadence**: Standardized to **1000ms (1.0s)** for steady, jitter-free status updates (`GET /api/invoices/{id}/status`).
* **Real-time Extraction Display**: The moment the `Extract` stage completes, an extracted metadata bar slides in displaying Vendor, Invoice #, Date, Total Amount, PO reference, and extraction method (`text` or `vision`).

### State 4: Decision & Explainability Inspector
The inspector separates core requirements from extended depth:
* **Core Requirement (Definition of Done)**:
  * High-contrast decision banner (`AUTO_APPROVED`, `FLAGGED_FOR_REVIEW`, `REJECTED`).
  * Reason code badge (e.g. `AMOUNT_OUT_OF_TOLERANCE`, `DUPLICATE_INVOICE`).
  * Plain-English explanation sentence citing exact comparison numbers.
  * **Rules Evaluation Trail (Required)**: Full chronological audit of all 8 rules (Critical Fields, Arithmetic Check, Duplicates, Approved Vendor, PO Match, PO Status, Tolerance Band, Split-PO Cumulative Limit) with Pass/Fail state and reason detail.
* **Extended Audit Depth (Tier-2)**:
  * **PO Reconciliation**: Side-by-side comparison of invoice total against PO amount, cumulative balance, and tolerance limits.
  * **Extracted Data & Confidence**: Line items table with quantities and unit prices, plus color-coded per-field extraction confidence meters (0–100%).
  * **Stage Run Logs**: Millisecond execution log with timestamps.

### State 5: Invoices Dashboard & History
* Active when runs exist in the database:
  * **KPI Metric Cards**: Total Processed, Auto-Approved, Flagged for Review, Rejected.
  * **Status Filter Pills**: `All Runs`, `Approved`, `Flagged`, `Rejected`.
  * **Search Bar**: Instant filter by vendor name, invoice number, or ID.
  * **Table of Previous Invoices**: Click any row to re-inspect its full decision trail.

---

## Edge Cases Reference

| Edge Case | Description | Expected Decision | Reason Code |
|---|---|---|---|
| **Happy Path** | Standard clean digital invoice | `AUTO_APPROVED` | `ALL_RULES_PASSED` |
| **Edge Case 1** | Scanned / low-quality noisy image PDF | `FLAGGED_FOR_REVIEW` | `LOW_CONFIDENCE_EXTRACTION` |
| **Edge Case 2a** | Split-PO delivery 1 ($3,000 against $6,000 PO) | `AUTO_APPROVED` | `ALL_RULES_PASSED` |
| **Edge Case 2b** | Split-PO delivery 2 ($3,800 pushes cumulative to $6,800) | `FLAGGED_FOR_REVIEW` | `SPLIT_PO_CUMULATIVE_EXCEEDED` |
| **Edge Case 3** | Amount outside tolerance ($10,310 vs $10,000 PO, 3.1% > 2%) | `FLAGGED_FOR_REVIEW` | `AMOUNT_OUT_OF_TOLERANCE` |
| **Edge Case 4** | Duplicate invoice submission (same vendor + invoice #) | `REJECTED` | `DUPLICATE_INVOICE` |
| **Extended** | Invoice from unapproved / unknown vendor | `FLAGGED_FOR_REVIEW` | `UNAPPROVED_VENDOR` |
| **Extended** | Invoice matched to a closed PO | `FLAGGED_FOR_REVIEW` | `PO_CLOSED` |
| **Extended** | Invoice with tampered line items (subtotal ≠ sum) | `FLAGGED_FOR_REVIEW` | `ARITHMETIC_MISMATCH` |

---

## Testing & Accuracy Benchmark

### 1. Deterministic Rule Engine Unit Tests (18/18 Passing)
```bash
python -m pytest test_rules_engine.py -v
```

### 2. Real-World Kaggle Dataset Benchmark (100 Invoices)
Benchmark evaluation on 100 real-world invoice PDFs from [`devp1866/high-quality-ocr-ready-invoice-pdfs`](https://www.kaggle.com/datasets/devp1866/high-quality-ocr-ready-invoice-pdfs):
```bash
python benchmark_kaggle_dataset.py
```
* **Extraction Accuracy**: 100.0% (100/100 invoices matched ground truth)
* **Processing Latency**: 6.8 ms average per invoice
* **Throughput**: 133+ invoices/second
* **Report Artifact**: See [`kaggle_benchmark_report.md`](file:///C:/Users/Cog/.gemini/antigravity-ide/brain/c3593bba-6601-4bfd-9032-113021628903/kaggle_benchmark_report.md) and [`kaggle_benchmark_results.json`](file:///d:/InvoiceTracker(Zapp.ai)/kaggle_benchmark_results.json)

