import json
import os
import unittest
from unittest.mock import patch

import index


class FakeResponse:
    def __init__(self, status=204, body=b""):
        self.status = status
        self.body = body

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc_value, traceback):
        return False

    def read(self):
        return self.body


class SchedulerTest(unittest.TestCase):
    def test_dispatches_expected_workflow(self):
        captured = {}

        def fake_urlopen(request, timeout):
            captured["request"] = request
            captured["timeout"] = timeout
            return FakeResponse()

        result = index.dispatch_workflow("github-token", urlopen=fake_urlopen)
        request = captured["request"]
        self.assertEqual(result["status"], 204)
        self.assertIsNone(result["workflow_run_id"])
        self.assertEqual(captured["timeout"], 30)
        self.assertEqual(request.get_method(), "POST")
        self.assertEqual(
            request.full_url,
            "https://api.github.com/repos/wyhgnss/wyhgnss.github.io/actions/workflows/update-lpw.yml/dispatches",
        )
        self.assertEqual(
            json.loads(request.data),
            {
                "ref": "main",
                "inputs": {"force": False},
                "return_run_details": True,
            },
        )
        self.assertEqual(request.headers["Authorization"], "Bearer github-token")

    def test_accepts_run_details_response(self):
        body = json.dumps(
            {
                "workflow_run_id": 42337395702,
                "run_url": "https://api.github.com/repos/wyhgnss/wyhgnss.github.io/actions/runs/42337395702",
                "html_url": "https://github.com/wyhgnss/wyhgnss.github.io/actions/runs/42337395702",
            }
        ).encode("utf-8")

        result = index.dispatch_workflow(
            "github-token",
            urlopen=lambda request, timeout: FakeResponse(status=200, body=body),
        )

        self.assertEqual(result["status"], 200)
        self.assertEqual(result["workflow_run_id"], 42337395702)
        self.assertTrue(result["html_url"].endswith("/42337395702"))

    def test_handler_requires_token(self):
        with patch.dict(os.environ, {}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "GITHUB_TOKEN"):
                index.main_handler({"Type": "Timer"}, object())


if __name__ == "__main__":
    unittest.main()
