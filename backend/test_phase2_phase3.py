import os
import sys
import unittest
from fastapi.testclient import TestClient

# Ensure backend package import
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from main import app
from database import init_db

class TestPhase2Phase3Integration(unittest.TestCase):
    def setUp(self):
        self.client = TestClient(app)
        init_db()

    def test_pdf_serving(self):
        # inv-hist-happy-01 is one of seeded invoices
        res = self.client.get("/api/invoices/inv-hist-happy-01/pdf")
        self.assertEqual(res.status_code, 200)
        self.assertEqual(res.headers.get("content-type"), "application/pdf")

    def test_email_webhook_ingestion(self):
        payload = {
            "sender": "billing@acmeindustrial.com",
            "subject": "Invoice #INV-2026-9912 - Acme Industrial Supplies",
            "pdf_url": "happy_01_acme.pdf"
        }
        res = self.client.post("/api/webhooks/email-ingest", json=payload)
        self.assertEqual(res.status_code, 202)
        data = res.json()
        self.assertEqual(data["status"], "accepted")
        self.assertIn("invoice_id", data)

    def test_hitl_override(self):
        # Override flagged tolerance invoice
        target_id = "inv-hist-flagged-tol"
        override_payload = {
            "decision": "AUTO_APPROVED",
            "reason": "Director approved 1.8% variance via Slack exception #AP-9941."
        }
        res = self.client.post(f"/api/invoices/{target_id}/override", json=override_payload)
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(data["decision"]["status"], "AUTO_APPROVED")
        self.assertEqual(data["decision"]["reason_code"], "MANUAL_OVERRIDE")
        self.assertIn("Manually overridden by AP Manager", data["decision"]["reason_detail"])

        # Check rules trail contains human_in_the_loop_override rule
        rule_names = [r["rule_name"] for r in data["decision"]["rules_evaluated"]]
        self.assertIn("human_in_the_loop_override", rule_names)

    def test_hitl_override_missing_reason_rejected(self):
        target_id = "inv-hist-flagged-tol"
        override_payload = {
            "decision": "AUTO_APPROVED",
            "reason": "   "
        }
        res = self.client.post(f"/api/invoices/{target_id}/override", json=override_payload)
        self.assertEqual(res.status_code, 400)

if __name__ == "__main__":
    unittest.main()
