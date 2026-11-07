"""Tencent SCF timer function that starts the hourly GitHub LPW workflow."""

from __future__ import annotations

import json
import os
import urllib.error
import urllib.request
from datetime import datetime, timezone


OWNER = "wyhgnss"
REPOSITORY = "wyhgnss.github.io"
WORKFLOW = "update-lpw.yml"
REF = "main"
GITHUB_API_VERSION = "2026-03-10"


def dispatch_workflow(token: str, urlopen=urllib.request.urlopen) -> dict:
    endpoint = (
        f"https://api.github.com/repos/{OWNER}/{REPOSITORY}"
        f"/actions/workflows/{WORKFLOW}/dispatches"
    )
    request = urllib.request.Request(
        endpoint,
        data=json.dumps(
            {
                "ref": REF,
                "inputs": {"force": False},
                "return_run_details": True,
            }
        ).encode("utf-8"),
        method="POST",
        headers={
            "Accept": "application/vnd.github+json",
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "lpw-hourly-scheduler",
            "X-GitHub-Api-Version": GITHUB_API_VERSION,
        },
    )
    try:
        with urlopen(request, timeout=30) as response:
            status = response.status
            response_body = response.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as error:
        response_body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(
            f"GitHub workflow dispatch failed ({error.code}): {response_body[:500]}"
        ) from error
    if status not in {200, 204}:
        raise RuntimeError(f"GitHub workflow dispatch returned unexpected status {status}: {response_body[:500]}")
    details = {}
    if response_body:
        try:
            details = json.loads(response_body)
        except json.JSONDecodeError as error:
            raise RuntimeError(
                f"GitHub workflow dispatch returned invalid JSON ({status}): {response_body[:500]}"
            ) from error
    return {
        "status": status,
        "workflow_run_id": details.get("workflow_run_id"),
        "run_url": details.get("run_url"),
        "html_url": details.get("html_url"),
    }


def main_handler(event, context):
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Missing required GITHUB_TOKEN environment variable.")

    dispatch = dispatch_workflow(token)
    result = {
        "event": "workflow_dispatch",
        "repository": f"{OWNER}/{REPOSITORY}",
        "workflow": WORKFLOW,
        "ref": REF,
        "github_status": dispatch["status"],
        "workflow_run_id": dispatch["workflow_run_id"],
        "run_url": dispatch["run_url"],
        "html_url": dispatch["html_url"],
        "dispatched_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "trigger_type": event.get("Type") if isinstance(event, dict) else None,
        "request_id": getattr(context, "request_id", None),
    }
    print(json.dumps(result, ensure_ascii=False))
    return result
