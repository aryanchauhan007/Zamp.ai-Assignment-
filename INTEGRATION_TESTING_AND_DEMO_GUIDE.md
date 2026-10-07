# Integration Testing & Live Demo Guide
## Invoice-to-Decision Engine (Zamp PS-1 Case Study)

---

## Part 1: End-to-End Integration Testing
Run this checklist before recording your 5-minute demo video, and again 30 minutes before your live interview.

### Pre-Test Setup (do once)
```bash
# Terminal 1: Backend
cd backend
python -m uvicorn main:app --reload --port 8000

# Terminal 2: Frontend
cd frontend
npm run dev -- -p 3001

# Verify both are running
# Backend: http://localhost:8000/docs should load Swagger UI
# Frontend: http://localhost:3001 should show empty invoice review screen
```

### Test Suite (run in order — each test is ~30 seconds)

#### Test 1: Frontend Loads & API Connected
- [ ] Navigate to `http://localhost:3001`
- [ ] Page renders the header (wordmark, nav tabs, engine status)
- [ ] Main section shows "Invoice Review" heading + clear invitation
- [ ] "Run an Invoice" button is visible and clickable
- [ ] Open browser DevTools → Network tab → verify `GET /api/invoices` returns 200 with empty array

**Expected state:** Empty state, no errors in console.

---

#### Test 2: Happy Path — End-to-End Run
- [ ] Click "Run an Invoice" button
- [ ] Modal/launcher appears with "File Upload" and "Test Cases" tabs/panels
- [ ] In "Test Cases", see: "Happy Path", "Edge Case 1 — Scanned Low-Quality", "Edge Case 2a — Split PO (first)", "Edge Case 2b — Split PO (second)", "Edge Case 3 — Amount Out of Tolerance", "Edge Case 4 — Duplicate"
- [ ] Select "Happy Path"
- [ ] LiveRunPanel appears at top with stepper showing "Ingest" in progress
- [ ] Watch stepper advance: Ingest (done) → Extract (done) → Validate (done) → Match PO (done) → Apply Rules (done) → Decision (done)
- [ ] Decision banner appears: **GREEN pill "Approved"** with reason **"All business rules passed -- invoice auto-approved"**
- [ ] Reasoning trail shows 5 rules, all with ✓ checkmarks
- [ ] Stat row updates: "Processed Today" now = 1, "Auto-Approved %" = 100%
- [ ] New row appears in invoice table: vendor name, invoice number, amount, status pill (green), timestamp

**Expected state:** One approved invoice in table, stats updated, no console errors.

**Timing:** Should complete in <15 seconds start to finish.

---

#### Test 3: Reset Demo Data
- [ ] While the happy-path run is still in the panel, click "Reset Demo" button in the header
- [ ] LiveRunPanel closes
- [ ] Table clears immediately
- [ ] Stat row returns to clean state
- [ ] Empty state re-renders with "Run an Invoice" button

**Expected state:** Back to empty state, fresh database.

---

#### Test 4: Edge Case 1 — Scanned/Low-Quality PDF
- [ ] Click "Run an Invoice" → select "Edge Case 1 — Scanned Low-Quality"
- [ ] Stepper advances through Ingest → Extract → Validate
- [ ] At "Extract" stage, watch for:
  - Low confidence scores (<0.7) on critical fields in the live-panel detail
- [ ] Decision banner appears: **AMBER pill "Flagged for Review"** with reason **"Low-confidence or missing extraction on: vendor_name, total"**
- [ ] Reasoning trail shows first rule Failed: ✗ Critical Field Check

**Expected state:** Flagged invoice, amber status, clear reason for low confidence.

**Why this matters:** Proves the system degrades gracefully when signal is weak, doesn't silently guess.

---

#### Test 5: Edge Case 2a & 2b — Split PO
- [ ] Click "Run an Invoice" → select "Edge Case 2a — Split PO (first)"
- [ ] Stepper completes, decision is **GREEN "Approved"** (first invoice against $6,000 PO is $3,000, within tolerance)
- [ ] Reasoning trail shows: ✓ Amount within tolerance → detail shows "$3,000 against $6,000 PO"
- [ ] Stat row updates: cumulative invoiced tracks to $3,000
- [ ] Now click "Run an Invoice" again → select "Edge Case 2b — Split PO (second)"
- [ ] This invoice is $3,800 (cumulative now $6,800.01)
- [ ] Decision banner: **AMBER "Flagged for Review"** with reason **"Cumulative invoiced ($6,800.01) would exceed PO amount $6,000.00 (limit with tolerance: $6,120.00)"**
- [ ] Reasoning trail shows: ✗ Split-PO Cumulative Check Failed

**Expected state:** First invoice approves, second flags with split-PO cumulative reasoning. Both sit in history.

**Why this matters:** Tests that the system tracks state across multiple runs and applies split-PO logic correctly.

---

#### Test 6: Edge Case 3 — Amount Out of Tolerance
- [ ] Reset demo data
- [ ] Click "Run an Invoice" → select "Edge Case 3 — Amount Out of Tolerance"
- [ ] Decision: **AMBER "Flagged for Review"** with reason **"Amount out of tolerance"**
- [ ] Reasoning trail shows: ✗ Tolerance Check → detail = "Invoice total $10,310.00 vs PO $10,000.00 (delta $310.00, tolerance $200.00) -- exceeds tolerance"
- [ ] Verify the exact numbers are shown, not just "mismatch"

**Expected state:** Flagged, with precise delta and tolerance numbers visible.

**Why this matters:** Demonstrates that the decision logic is explicit and quantitative, not vague.

---

#### Test 7: Edge Case 4 — Duplicate
- [ ] Run "Happy Path" once
- [ ] Immediately run "Edge Case 4 — Duplicate" (same invoice re-submitted)
- [ ] Decision: **RED "Rejected"** with reason **"Duplicate invoice"**
- [ ] Reasoning trail shows: ✗ Duplicate Check → detail = "Duplicate of invoice [original invoice ID] processed on [date]"

**Expected state:** Second run rejected, references original run.

**Why this matters:** Prevents double-payment fraud; proves the system has memory across submissions.

---

#### Test 8: Filtering & Row Inspection
- [ ] After running Happy Path + edge cases, view the dashboard
- [ ] Stat cards show total processed, approved, flagged, and rejected
- [ ] Click filter pill "Approved" → table filters to approved rows
- [ ] Click filter pill "Flagged" → table filters to flagged rows
- [ ] Click filter pill "Rejected" → table filters to rejected rows
- [ ] Click any row → inspects the full reasoning trail, PO reconciliation, and line items

**Expected state:** Filtering works, row inspection displays full reasoning without losing context.

---

#### Test 9: Accessibility & Visual Contrast
- [ ] Dark mode high contrast palette (WCAG AA compliant contrast ratios)
- [ ] Semantic status pills (green, amber, red) maintain clear visibility
- [ ] Stepper dots and connecting lines remain visible
- [ ] No layout shift or reflow

---

#### Test 10: Keyboard Navigation
- [ ] Use Tab / Shift+Tab to navigate interactive buttons, tabs, and table rows
- [ ] Focus rings are visible on every interactive element
- [ ] Enter key activates buttons and table rows

---

#### Test 11: Error Resilience
- [ ] If backend is temporarily unavailable, frontend displays clear status banner
- [ ] Auto-reconnects when backend restarts without page reload

---

#### Test 12: Load & Performance Baseline
- [ ] Initial paint: <500ms
- [ ] Stepper animation: smooth
- [ ] Stat updates: instant after decision completes
- [ ] Table row insertion: immediate

---

## Part 2: 5-Minute Demo Script (Narration + Live Execution)

### Pre-Demo Checklist (run 10 minutes before)
```bash
# Terminal 1: Backend
cd backend && python -m uvicorn main:app --reload --port 8000 --log-level warning

# Terminal 2: Frontend
cd frontend && npm run dev -- -p 3001

# Browser: http://localhost:3001
# Click "Reset Demo Data" to ensure clean empty state
```

### Demo Narrative (5 min total)

**[0:00–0:30] Problem & Intro**
> "Today I'm walking through an AI-powered invoice review system. Accounts-payable teams at mid-size companies spend hours every week manually opening vendor invoices, hunting for matching purchase orders, checking the math, and deciding whether to pay, flag, or reject each one.
>
> This system automates that entire workflow end-to-end, and the key design goal is explainability — every decision has visible reasoning behind it. Let me show you how it works."

**[0:30–1:15] Happy Path Live**
> [Click "Run an Invoice" → Select "Happy Path — Clean Invoice"]
>
> "First, I'll run a standard invoice. This is a clean PDF from Acme Supplies.
> Watch the live pipeline stepper: the system extracts the data, validates the internal arithmetic, matches against our purchase order registry, and applies business rules.
>
> In seconds, it auto-approves: all 5 rules passed, total matches the PO, no duplicate. It is queued for settlement."

**[1:15–3:00] The 3 Core Edge Cases**

**Edge Case 1: Low-Quality Scan**
> [Click "Run an Invoice" → Select "Edge Case 1 — Scanned / Low Quality"]
>
> "This time, the invoice is a scanned image — noisy and skewed. The system routes to the vision path. Here's the critical judgment: confidence on critical fields drops below 70%.
>
> Instead of hallucinating or silently guessing, it flags it for human review citing `LOW_CONFIDENCE_EXTRACTION`. That's safe AP automation."

**Edge Case 2: Split PO Cumulative**
> [Click "Run an Invoice" → Select "Edge Case 2a — Split PO (Delivery 1)"]
>
> "Here, a $6,000 PO is delivered in milestones. Delivery 1 for $3,000 auto-approves, and the PO tracks $3,000 invoiced.
>
> Now the vendor submits Delivery 2 for $3,800."
> [Select "Edge Case 2b — Split PO (Delivery 2)"]
>
> "The cumulative total reaches $6,800, breaching the $6,000 PO limit (+2% tolerance). It flags for review with `SPLIT_PO_CUMULATIVE_EXCEEDED`. This prevents multi-invoice over-billing."

**Edge Case 3: Near-Miss Tolerance**
> [Select "Edge Case 3 — Amount Just Outside Tolerance"]
>
> "Last edge case: invoice is $10,310 against a $10,000 PO. That is 3.1% over, exceeding our 2% ($200) tolerance band.
>
> It flags with the exact math: 'Invoice $10,310 vs PO $10,000 (delta $310, tolerance $200)'. No black-box scores."

**[3:00–4:30] Dashboard & History**
> [Scroll down to the Invoices Dashboard]
>
> "Here is our audit history with KPI breakdowns. We can filter by Approved, Flagged, or Rejected.
>
> Clicking any past invoice re-opens the complete decision inspector with the exact rule trail, PO reconciliation, and line items."

**[4:30–5:00] Wrap-Up**
> "Three key takeaways:
> 1. It runs end-to-end today on real PDFs.
> 2. Every decision is explainable with mathematical proofs, not probabilistic black boxes.
> 3. It handles the real-world messiness of procurement: scans, split-POs, tolerance boundaries, and duplicates.
>
> Thank you."

---

## Part 3: Live Interview Troubleshooting Runbook

### Quick Diagnostic Table

| Symptom | Cause | One-Command Resolution |
|---|---|---|
| `Port 8000 already in use` | Lingering uvicorn instance | `Get-NetTCPConnection -LocalPort 8000` & terminate PID, or restart terminal |
| `Port 3001 already in use` | Lingering next instance | Run on next port or kill process |
| `Cannot reach API` | Backend not started | `python -m uvicorn main:app --host 127.0.0.1 --port 8000` |
| `DB state dirty` | Prior test runs | Click **Reset Demo Data** in header or call `curl -X POST http://localhost:8000/api/demo/reset` |

---

## Interview Q&A Talking Points

* **"Why not use an LLM for the final decision?"**  
  *"LLMs are phenomenal at extracting unstructured data from messy documents into JSON. But financial decisions must be 100% deterministic, audit-compliant, and mathematically explainable. We use AI for extraction, and pure deterministic Python for business rules."*

* **"How does it handle duplicate invoices?"**  
  *"We fingerprint invoices on both `(vendor + invoice_number)` and `(vendor + total + date)`. Even if a vendor alters the invoice number, identical amounts on the same date trigger duplicate rejection."*

* **"What would you build in v2?"**  
  *"1. Human-in-the-loop correction feedback loop to calibrate extraction confidence. 2. Real ERP webhook integration (NetSuite / SAP). 3. Distributed locking on PO cumulative totals for high-throughput batching."*
