import json
import os
import unittest
from unittest.mock import patch

import index


ROOT_HTML = b'<a href="202610/">202610/</a><a href="202611/">202611/</a>'
MONTH_HTML = b'<a href="comp20261109.010000.nc">old</a><a href="comp20261109.020000.nc">new</a>'


class FakeResponse:
    def __init__(self, status=200, body=b""):
        self.status = status
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return self.body


def archive_body(timestamp):
    return json.dumps({"years": [{"last_timestamp": timestamp}]}).encode("utf-8")


class SchedulerTest(unittest.TestCase):
    def test_dispatches_only_when_source_is_new(self):
        captured_dispatch = {}

        def fake_urlopen(request, timeout):
            url = request.full_url
            if url == index.MIMIC_BASE_URL:
                return FakeResponse(body=ROOT_HTML)
            if url == index.MIMIC_BASE_URL + "202611/":
                return FakeResponse(body=MONTH_HTML)
            if "/contents/lpw/data/mimic-archive.json" in url:
                return FakeResponse(body=archive_body("2026-11-09T01:00:00Z"))
            if "/runs?" in url:
                return FakeResponse(body=b'{"workflow_runs": []}')
            if url.endswith("/dispatches"):
                captured_dispatch["request"] = request
                response = {
                    "workflow_run_id": 123,
                    "run_url": "https://api.github.com/runs/123",
                    "html_url": "https://github.com/runs/123",
                }
                return FakeResponse(body=json.dumps(response).encode("utf-8"))
            raise AssertionError(f"Unexpected request: {url}")

        with patch.dict(os.environ, {"GITHUB_TOKEN": "github-token"}, clear=True):
            result = index.main_handler({"Type": "Timer"}, object(), urlopen=fake_urlopen)

        self.assertEqual(result["action"], "dispatched")
        self.assertTrue(result["dispatched"])
        self.assertEqual(result["source_latest_timestamp"], "2026-11-09T02:00:00Z")
        self.assertEqual(result["published_latest_timestamp"], "2026-11-09T01:00:00Z")
        payload = json.loads(captured_dispatch["request"].data)
        self.assertEqual(payload["inputs"], {"force": True})
        self.assertEqual(captured_dispatch["request"].headers["Authorization"], "Bearer github-token")

    def test_up_to_date_does_not_check_runs_or_dispatch(self):
        def fake_urlopen(request, timeout):
            url = request.full_url
            if url == index.MIMIC_BASE_URL:
                return FakeResponse(body=ROOT_HTML)
            if url == index.MIMIC_BASE_URL + "202611/":
                return FakeResponse(body=MONTH_HTML)
            if "/contents/lpw/data/mimic-archive.json" in url:
                return FakeResponse(body=archive_body("2026-11-09T02:00:00Z"))
            raise AssertionError(f"No further request expected: {url}")

        with patch.dict(os.environ, {"GITHUB_TOKEN": "github-token"}, clear=True):
            result = index.main_handler({"Type": "Timer"}, object(), urlopen=fake_urlopen)

        self.assertEqual(result["action"], "up_to_date")
        self.assertFalse(result["dispatched"])

    def test_active_run_prevents_duplicate_dispatch(self):
        def fake_urlopen(request, timeout):
            url = request.full_url
            if url == index.MIMIC_BASE_URL:
                return FakeResponse(body=ROOT_HTML)
            if url == index.MIMIC_BASE_URL + "202611/":
                return FakeResponse(body=MONTH_HTML)
            if "/contents/lpw/data/mimic-archive.json" in url:
                return FakeResponse(body=archive_body("2026-11-09T01:00:00Z"))
            if "/runs?" in url:
                runs = {
                    "workflow_runs": [
                        {"id": 456, "status": "in_progress", "html_url": "https://github.com/runs/456"}
                    ]
                }
                return FakeResponse(body=json.dumps(runs).encode("utf-8"))
            raise AssertionError(f"Dispatch should not occur: {url}")

        with patch.dict(os.environ, {"GITHUB_TOKEN": "github-token"}, clear=True):
            result = index.main_handler({"Type": "Timer"}, object(), urlopen=fake_urlopen)

        self.assertEqual(result["action"], "workflow_active")
        self.assertFalse(result["dispatched"])
        self.assertEqual(result["active_run_id"], 456)

    def test_source_parser_uses_latest_month_and_product(self):
        requested = []

        def fake_urlopen(request, timeout):
            requested.append(request.full_url)
            if request.full_url == index.MIMIC_BASE_URL:
                return FakeResponse(body=ROOT_HTML)
            return FakeResponse(body=MONTH_HTML)

        timestamp = index.fetch_latest_mimic_timestamp(urlopen=fake_urlopen)

        self.assertEqual(index._format_timestamp(timestamp), "2026-11-09T02:00:00Z")
        self.assertEqual(requested[-1], index.MIMIC_BASE_URL + "202611/")

    def test_accepts_empty_dispatch_response(self):
        result = index.dispatch_workflow(
            "github-token",
            urlopen=lambda request, timeout: FakeResponse(status=204),
        )

        self.assertEqual(result["status"], 204)
        self.assertIsNone(result["workflow_run_id"])

    def test_handler_requires_token(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "GITHUB_TOKEN"):
                index.main_handler({"Type": "Timer"}, object())


if __name__ == "__main__":
    unittest.main()
