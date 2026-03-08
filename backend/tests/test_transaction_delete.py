"""
Tests for transaction deletion endpoints.

Prerequisites:
  - Backend server running on http://localhost:8000
  - INTERNAL_AUTH_SECRET set in environment
  - PostgreSQL running with test data
"""
import os
import sys
import hmac
import hashlib
import time
import json
import unittest
from uuid import uuid4

import requests

BASE_URL = os.getenv("BACKEND_URL", "http://localhost:8000")
INTERNAL_AUTH_SECRET = os.getenv("INTERNAL_AUTH_SECRET", "test-internal-auth-secret")


def _auth_headers(method: str, path: str, user_id: str = "test-delete-user") -> dict:
    timestamp = str(int(time.time()))
    payload = f"{method}\n{path}\n{user_id}\n{timestamp}"
    signature = hmac.new(
        INTERNAL_AUTH_SECRET.encode(), payload.encode(), hashlib.sha256
    ).hexdigest()
    return {
        "Content-Type": "application/json",
        "x-syllogic-user-id": user_id,
        "x-syllogic-timestamp": timestamp,
        "x-syllogic-signature": signature,
    }


class TestDeletePreview(unittest.TestCase):
    """Tests for POST /api/transactions/delete-preview."""

    def test_empty_request_returns_400(self):
        path = "/api/transactions/delete-preview"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={},
            headers=_auth_headers("POST", path),
        )
        self.assertEqual(resp.status_code, 400)

    def test_nonexistent_ids_returns_404(self):
        path = "/api/transactions/delete-preview"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={"transaction_ids": [str(uuid4())]},
            headers=_auth_headers("POST", path),
        )
        self.assertEqual(resp.status_code, 404)

    def test_nonexistent_import_returns_404(self):
        path = "/api/transactions/delete-preview"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={"import_id": str(uuid4())},
            headers=_auth_headers("POST", path),
        )
        self.assertEqual(resp.status_code, 404)


class TestDeleteTransactions(unittest.TestCase):
    """Tests for POST /api/transactions/delete."""

    def test_invalid_confirmation_returns_400(self):
        path = "/api/transactions/delete"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={"transaction_ids": [str(uuid4())], "confirmation": "wrong text"},
            headers=_auth_headers("POST", path),
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid confirmation", resp.json().get("detail", ""))

    def test_empty_ids_returns_400(self):
        path = "/api/transactions/delete"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={"transaction_ids": [], "confirmation": "delete transactions"},
            headers=_auth_headers("POST", path),
        )
        self.assertEqual(resp.status_code, 400)

    def test_nonexistent_ids_returns_404(self):
        path = "/api/transactions/delete"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={
                "transaction_ids": [str(uuid4())],
                "confirmation": "delete transactions",
            },
            headers=_auth_headers("POST", path),
        )
        self.assertEqual(resp.status_code, 404)

    def test_confirmation_is_case_insensitive(self):
        path = "/api/transactions/delete"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={
                "transaction_ids": [str(uuid4())],
                "confirmation": "DELETE TRANSACTIONS",
            },
            headers=_auth_headers("POST", path),
        )
        # Should pass validation (400 or 404 from no matching txns, not 400 for bad confirmation)
        self.assertIn(resp.status_code, [404])


class TestRevertImport(unittest.TestCase):
    """Tests for POST /api/transactions/revert-import."""

    def test_invalid_confirmation_returns_400(self):
        path = "/api/transactions/revert-import"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={"import_id": str(uuid4()), "confirmation": "nope"},
            headers=_auth_headers("POST", path),
        )
        self.assertEqual(resp.status_code, 400)
        self.assertIn("Invalid confirmation", resp.json().get("detail", ""))

    def test_nonexistent_import_returns_404(self):
        path = "/api/transactions/revert-import"
        resp = requests.post(
            f"{BASE_URL}{path}",
            json={
                "import_id": str(uuid4()),
                "confirmation": "delete transactions",
            },
            headers=_auth_headers("POST", path),
        )
        self.assertEqual(resp.status_code, 404)


class TestImportHistory(unittest.TestCase):
    """Tests for GET /api/csv-import/history."""

    def test_returns_list(self):
        path = "/api/csv-import/history"
        resp = requests.get(
            f"{BASE_URL}{path}",
            headers=_auth_headers("GET", path),
        )
        self.assertEqual(resp.status_code, 200)
        data = resp.json()
        self.assertIsInstance(data, list)


if __name__ == "__main__":
    unittest.main()
