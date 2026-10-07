"""
benchmark_kaggle_dataset.py -- Accuracy & Efficiency Benchmark for Invoice Decision Engine.

Evaluates:
  1. Field Extraction Accuracy vs Ground Truth (Batch 1 CSV from Kaggle)
  2. Processing Latency & Throughput (Efficiency)
  3. 8-Rule Decision Engine Execution Performance
"""

import csv
import json
import os
import sys
import time
from dataclasses import dataclass, asdict
from datetime import datetime

# Add backend to path
BACKEND_DIR = os.path.join(os.path.dirname(__file__), "backend")
sys.path.insert(0, BACKEND_DIR)

from extractor import extract_invoice
from models import Invoice, PurchaseOrder
from rules_engine import evaluate


DATASET_DIR = r"C:\Users\Cog\.cache\kagglehub\datasets\devp1866\high-quality-ocr-ready-invoice-pdfs\versions\1\Batch 1"
CSV_PATH = os.path.join(DATASET_DIR, "batch_1.csv")
INVOICES_DIR = os.path.join(DATASET_DIR, "invoices")


@dataclass
class MetricSummary:
    total_invoices: int
    vendor_matches: int
    vendor_accuracy: float
    invoice_no_matches: int
    invoice_no_accuracy: float
    date_matches: int
    date_accuracy: float
    total_amount_matches: int
    total_amount_accuracy: float
    subtotal_matches: int
    subtotal_accuracy: float
    tax_matches: int
    tax_accuracy: float
    all_fields_exact_match: int
    all_fields_accuracy: float
    total_time_seconds: float
    avg_latency_ms: float
    min_latency_ms: float
    max_latency_ms: float
    throughput_invoices_per_sec: float


def run_benchmark(limit: int | None = None) -> dict:
    if not os.path.exists(CSV_PATH) or not os.path.exists(INVOICES_DIR):
        raise FileNotFoundError(f"Dataset not found at {DATASET_DIR}")

    print("=" * 70)
    print(" INVOICE-TO-DECISION ENGINE: ACCURACY & EFFICIENCY BENCHMARK")
    print(f" Dataset: devp1866/high-quality-ocr-ready-invoice-pdfs (Batch 1)")
    print(f" Source Directory: {INVOICES_DIR}")
    print("=" * 70)

    # 1. Load Ground Truth
    ground_truth = {}
    with open(CSV_PATH, mode="r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            filename = row["filename"]
            json_meta = json.loads(row["json_data"])
            ground_truth[filename] = json_meta

    total_files = len(ground_truth)
    if limit:
        total_files = min(total_files, limit)

    print(f"\nLoaded {total_files} ground-truth invoice annotations.")
    print("Starting extraction and decision evaluation benchmark...\n")

    vendor_hits = 0
    inv_no_hits = 0
    date_hits = 0
    total_hits = 0
    subtotal_hits = 0
    tax_hits = 0
    perfect_hits = 0

    latencies_ms: list[float] = []
    rule_latencies_ms: list[float] = []

    decisions_summary = {
        "AUTO_APPROVED": 0,
        "FLAGGED_FOR_REVIEW": 0,
        "REJECTED": 0,
    }

    processed = 0
    start_bench_time = time.perf_counter()

    # Pre-generate mock PO for TechVision Distributors to test matching
    sample_pos = [
        PurchaseOrder(
            po_id="PO-TV-2023-01",
            vendor_name="TechVision Distributors Pvt Ltd",
            po_amount=2000000.0,
            po_date="2023-07-01",
            status="open",
            cumulative_invoiced=0.0,
        )
    ]

    for filename, gt in ground_truth.items():
        if limit and processed >= limit:
            break

        pdf_path = os.path.join(INVOICES_DIR, filename)
        if not os.path.exists(pdf_path):
            continue

        processed += 1
        invoice_id = f"bench_{processed:04d}"

        # Measure extraction latency
        t0 = time.perf_counter()
        invoice, _ = extract_invoice(pdf_path, invoice_id=invoice_id)
        t1 = time.perf_counter()
        latency_ms = (t1 - t0) * 1000.0
        latencies_ms.append(latency_ms)

        # Measure rule engine latency
        rt0 = time.perf_counter()
        decision = evaluate(
            invoice=invoice,
            all_pos=sample_pos,
            find_duplicate_fn=lambda **kwargs: None,
            get_invoice_fn=lambda _: None,
            invoices_against_po=[],
        )
        rt1 = time.perf_counter()
        rule_latencies_ms.append((rt1 - rt0) * 1000.0)
        decisions_summary[decision.status] = decisions_summary.get(decision.status, 0) + 1

        # Ground Truth values
        gt_vendor = gt["seller"]["name"].strip()
        gt_inv_no = str(gt["invoice_no"]).strip()
        gt_date = gt["date_of_issue"].strip() # e.g. 03/07/2023
        
        # Parse ground truth numeric values
        gt_subtotal = float(gt["summary"]["net_worth"].replace(",", "").strip())
        gt_tax = float(gt["summary"]["vat_amount"].replace(",", "").strip())
        gt_total = float(gt["summary"]["gross_worth"].replace(",", "").strip())

        # Comparison checks
        v_ok = (invoice.vendor_name.lower().strip() == gt_vendor.lower().strip())
        inv_ok = (invoice.invoice_number.strip() == gt_inv_no)
        
        # Date check (support either DD/MM/YYYY or YYYY-MM-DD converted)
        d_ok = False
        if invoice.invoice_date:
            if invoice.invoice_date == gt_date:
                d_ok = True
            else:
                parts = gt_date.split("/")
                if len(parts) == 3 and invoice.invoice_date == f"{parts[2]}-{parts[1]}-{parts[0]}":
                    d_ok = True

        tot_ok = abs(invoice.total - gt_total) < 0.05
        sub_ok = abs(invoice.subtotal - gt_subtotal) < 0.05
        tax_ok = abs(invoice.tax - gt_tax) < 0.05

        if v_ok: vendor_hits += 1
        if inv_ok: inv_no_hits += 1
        if d_ok: date_hits += 1
        if tot_ok: total_hits += 1
        if sub_ok: subtotal_hits += 1
        if tax_ok: tax_hits += 1
        if v_ok and inv_ok and d_ok and tot_ok and sub_ok and tax_ok:
            perfect_hits += 1

        if processed % 20 == 0 or processed == total_files:
            print(f"  Processed [{processed:3d}/{total_files}] | Current Avg Latency: {sum(latencies_ms)/len(latencies_ms):.1f}ms")

    total_bench_time = time.perf_counter() - start_bench_time

    # Compute summaries
    metrics = MetricSummary(
        total_invoices=processed,
        vendor_matches=vendor_hits,
        vendor_accuracy=round((vendor_hits / processed) * 100.0, 2),
        invoice_no_matches=inv_no_hits,
        invoice_no_accuracy=round((inv_no_hits / processed) * 100.0, 2),
        date_matches=date_hits,
        date_accuracy=round((date_hits / processed) * 100.0, 2),
        total_amount_matches=total_hits,
        total_amount_accuracy=round((total_hits / processed) * 100.0, 2),
        subtotal_matches=subtotal_hits,
        subtotal_accuracy=round((subtotal_hits / processed) * 100.0, 2),
        tax_matches=tax_hits,
        tax_accuracy=round((tax_hits / processed) * 100.0, 2),
        all_fields_exact_match=perfect_hits,
        all_fields_accuracy=round((perfect_hits / processed) * 100.0, 2),
        total_time_seconds=round(total_bench_time, 2),
        avg_latency_ms=round(sum(latencies_ms) / len(latencies_ms), 2),
        min_latency_ms=round(min(latencies_ms), 2),
        max_latency_ms=round(max(latencies_ms), 2),
        throughput_invoices_per_sec=round(processed / total_bench_time, 2),
    )

    avg_rule_lat_ms = sum(rule_latencies_ms) / len(rule_latencies_ms)

    print("\n" + "=" * 70)
    print(" BENCHMARK RESULTS SUMMARY")
    print("=" * 70)
    print(f"Total Invoices Tested:          {metrics.total_invoices}")
    print(f"Total Wall-Clock Time:          {metrics.total_time_seconds} s")
    print(f"Extraction Throughput:          {metrics.throughput_invoices_per_sec} invoices/sec")
    print(f"Average PDF Extraction Latency: {metrics.avg_latency_ms} ms (min: {metrics.min_latency_ms}ms, max: {metrics.max_latency_ms}ms)")
    print(f"Average Rule Engine Latency:    {avg_rule_lat_ms:.3f} ms")
    print("-" * 70)
    print(f"Field Extraction Accuracy:")
    print(f"  • Vendor Name:               {metrics.vendor_matches}/{metrics.total_invoices} ({metrics.vendor_accuracy}%)")
    print(f"  • Invoice Number:            {metrics.invoice_no_matches}/{metrics.total_invoices} ({metrics.invoice_no_accuracy}%)")
    print(f"  • Invoice Date:              {metrics.date_matches}/{metrics.total_invoices} ({metrics.date_accuracy}%)")
    print(f"  • Subtotal (Net Worth):      {metrics.subtotal_matches}/{metrics.total_invoices} ({metrics.subtotal_accuracy}%)")
    print(f"  • Tax / VAT Amount:          {metrics.tax_matches}/{metrics.total_invoices} ({metrics.tax_accuracy}%)")
    print(f"  • Total (Gross Worth):       {metrics.total_amount_matches}/{metrics.total_invoices} ({metrics.total_amount_accuracy}%)")
    print(f"  • Perfect Exact Match (All): {metrics.all_fields_exact_match}/{metrics.total_invoices} ({metrics.all_fields_accuracy}%)")
    print("-" * 70)
    print("Rules Engine Decision Breakdown:")
    for status, count in decisions_summary.items():
        pct = (count / processed) * 100.0
        print(f"  • {status:20s}: {count:3d} ({pct:5.1f}%)")
    print("=" * 70)

    # Save to JSON
    result_data = {
        "timestamp": datetime.now().isoformat(),
        "dataset": "devp1866/high-quality-ocr-ready-invoice-pdfs (Batch 1)",
        "metrics": asdict(metrics),
        "rule_engine_avg_latency_ms": round(avg_rule_lat_ms, 3),
        "decisions_breakdown": decisions_summary,
    }

    out_json = "kaggle_benchmark_results.json"
    with open(out_json, "w", encoding="utf-8") as f:
        json.dump(result_data, f, indent=2)
    print(f"\nDetailed metrics saved to: {out_json}")

    return result_data


if __name__ == "__main__":
    limit = int(sys.argv[1]) if len(sys.argv) > 1 else None
    run_benchmark(limit=limit)
