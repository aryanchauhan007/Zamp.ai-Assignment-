import os
import sys
import unittest
import time
from fastapi.testclient import TestClient

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from main import app, process_invoice, TEST_CASES
from database import init_db, get_invoice, get_decision, get_run_logs, list_pos, reset_demo_data
from seed_database import seed_purchase_orders, seed_historical_invoices

class TestAllEdgeCasesEndToEnd(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        init_db()
        # Reset DB to ensure fresh state for isolated edge-case pipeline execution
        reset_demo_data()
        seed_purchase_orders()
        cls.client = TestClient(app)

    @classmethod
    def tearDownClass(cls):
        # Restore pre-seeded demo history so the user dashboard has full production cards
        seed_historical_invoices()

    def test_01_happy_path_clean_invoice(self):
        """Happy Path: Standard clean PDF invoice within PO amount -> AUTO_APPROVED"""
        res = self.client.post("/api/test-cases/run?case_id=happy_path")
        self.assertEqual(res.status_code, 200)
        inv_id = res.json()["invoice_id"]
        
        # Wait for async processing or check decision
        for _ in range(30):
            dec = get_decision(inv_id)
            if dec:
                break
            time.sleep(0.3)

        self.assertIsNotNone(dec, "Decision should be produced for happy_path")
        self.assertEqual(dec.status, "AUTO_APPROVED")
        self.assertEqual(len(dec.rules_evaluated), 8)
        self.assertTrue(all(r.passed for r in dec.rules_evaluated))

    def test_02_edge_case_1_scanned_low_quality(self):
        """Edge Case 1: Scanned image with noise & skew -> FLAGGED_FOR_REVIEW"""
        res = self.client.post("/api/test-cases/run?case_id=edge_1")
        self.assertEqual(res.status_code, 200)
        inv_id = res.json()["invoice_id"]

        for _ in range(30):
            dec = get_decision(inv_id)
            if dec:
                break
            time.sleep(0.3)

        self.assertIsNotNone(dec, "Decision should be produced for edge_1")
        # Scanned invoice should be flagged for review due to low confidence or OCR
        self.assertEqual(dec.status, "FLAGGED_FOR_REVIEW")

    def test_03_edge_case_2a_split_po_delivery_1(self):
        """Edge Case 2a: Split PO Delivery 1 within cumulative budget -> AUTO_APPROVED"""
        res = self.client.post("/api/test-cases/run?case_id=edge_2a")
        self.assertEqual(res.status_code, 200)
        inv_id = res.json()["invoice_id"]

        for _ in range(30):
            dec = get_decision(inv_id)
            if dec:
                break
            time.sleep(0.3)

        self.assertIsNotNone(dec, "Decision should be produced for edge_2a")
        self.assertEqual(dec.status, "AUTO_APPROVED")

    def test_04_edge_case_2b_split_po_cumulative_exceeded(self):
        """Edge Case 2b: Split PO Delivery 2 pushing cumulative over limit -> FLAGGED_FOR_REVIEW"""
        res = self.client.post("/api/test-cases/run?case_id=edge_2b")
        self.assertEqual(res.status_code, 200)
        inv_id = res.json()["invoice_id"]

        for _ in range(30):
            dec = get_decision(inv_id)
            if dec:
                break
            time.sleep(0.3)

        self.assertIsNotNone(dec, "Decision should be produced for edge_2b")
        self.assertEqual(dec.status, "FLAGGED_FOR_REVIEW")
        self.assertEqual(dec.reason_code, "SPLIT_PO_CUMULATIVE_EXCEEDED")

    def test_05_edge_case_3_near_tolerance_overage(self):
        """Edge Case 3: Invoiced amount exceeding PO by > 2% tolerance -> FLAGGED_FOR_REVIEW"""
        res = self.client.post("/api/test-cases/run?case_id=edge_3")
        self.assertEqual(res.status_code, 200)
        inv_id = res.json()["invoice_id"]

        for _ in range(30):
            dec = get_decision(inv_id)
            if dec:
                break
            time.sleep(0.3)

        self.assertIsNotNone(dec, "Decision should be produced for edge_3")
        self.assertEqual(dec.status, "FLAGGED_FOR_REVIEW")
        self.assertEqual(dec.reason_code, "AMOUNT_OUT_OF_TOLERANCE")
        # Reason detail must cite exact amounts and tolerance
        self.assertIn("exceeds tolerance", dec.reason_detail)

    def test_06_edge_case_4_duplicate_invoice(self):
        """Edge Case 4: Duplicate re-submission of existing invoice -> REJECTED"""
        res = self.client.post("/api/test-cases/run?case_id=edge_4")
        self.assertEqual(res.status_code, 200)
        inv_id = res.json()["invoice_id"]

        for _ in range(30):
            dec = get_decision(inv_id)
            if dec:
                break
            time.sleep(0.3)

        self.assertIsNotNone(dec, "Decision should be produced for edge_4")
        self.assertEqual(dec.status, "REJECTED")
        self.assertEqual(dec.reason_code, "DUPLICATE_INVOICE")

if __name__ == "__main__":
    unittest.main()
