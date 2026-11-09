"""Tencent SCF timer that dispatches GitHub only for a new MIMIC product."""

from __future__ import annotations

import json
import os
import re
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone


OWNER = "wyhgnss"
REPOSITORY = "wyhgnss.github.io"
WORKFLOW = "update-lpw.yml"
REF = "main"
GITHUB_API_VERSION = "2026-03-10"
MIMIC_BASE_URL = "https://bin.ssec.wisc.edu/pub/mtpw2/data/"
ARCHIVE_PATH = "lpw/data/mimic-archive.json"
ACTIVE_RUN_STATUSES = {"requested", "waiting", "pending", "queued", "in_progress"}
USER_AGENT = "lpw-mimic-poller/1.0"


def _read_response(request, urlopen, description: str, timeout: int = 30) -> tuple[int, bytes]:
    try:
        with urlopen(request, timeout=timeout) as response:
            return response.status, response.read()
    except urllib.error.HTTPError as error:
        body = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{description} failed ({error.code}): {body[:500]}") from error
    except urllib.error.URLError as error:
        raise RuntimeError(f"{description} failed: {error.reason}") from error


def _get_text(url: str, urlopen, description: str) -> str:
    request = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
    status, body = _read_response(request, urlopen, description)
    if status != 200:
        raise RuntimeError(f"{description} returned unexpected status {status}")
    return body.decode("utf-8", errors="replace")


def _github_request(url: str, token: str | None = None, data: dict | None = None) -> urllib.request.Request:
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": USER_AGENT,
        "X-GitHub-Api-Version": GITHUB_API_VERSION,
    }
    if token:
        headers["Authorization"] = f"Bearer {token}"
    encoded_data = None
    method = "GET"
    if data is not None:
        encoded_data = json.dumps(data).encode("utf-8")
        headers["Content-Type"] = "application/json"
        method = "POST"
    return urllib.request.Request(url, data=encoded_data, method=method, headers=headers)


def _format_timestamp(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _parse_timestamp(value: str | None) -> datetime | None:
    if not value:
        return None
    return datetime.fromisoformat(value.replace("Z", "+00:00")).astimezone(timezone.utc)


def fetch_latest_mimic_timestamp(urlopen=urllib.request.urlopen) -> datetime:
    root_html = _get_text(MIMIC_BASE_URL, urlopen, "MIMIC directory request")
    months = sorted(set(re.findall(r'href=["\']?(\d{6})/?', root_html, flags=re.IGNORECASE)))
    if not months:
        raise RuntimeError("MIMIC directory did not contain a YYYYMM subdirectory.")

    latest_month = months[-1]
    month_url = urllib.parse.urljoin(MIMIC_BASE_URL, f"{latest_month}/")
    month_html = _get_text(month_url, urlopen, "MIMIC monthly directory request")
    products = re.findall(
        r"comp(\d{8})\.(\d{2})0000\.nc",
        month_html,
        flags=re.IGNORECASE,
    )
    if not products:
        raise RuntimeError(f"MIMIC directory {latest_month} did not contain a product.")

    date_part, hour_part = max(products)
    return datetime.strptime(date_part + hour_part, "%Y%m%d%H").replace(tzinfo=timezone.utc)


def fetch_published_timestamp(urlopen=urllib.request.urlopen) -> datetime | None:
    endpoint = (
        f"https://api.github.com/repos/{OWNER}/{REPOSITORY}/contents/"
        f"{ARCHIVE_PATH}?ref={urllib.parse.quote(REF)}"
    )
    request = _github_request(endpoint)
    request.add_header("Accept", "application/vnd.github.raw+json")
    status, body = _read_response(request, urlopen, "GitHub archive index request")
    if status != 200:
        raise RuntimeError(f"GitHub archive index returned unexpected status {status}")
    try:
        archive = json.loads(body)
    except json.JSONDecodeError as error:
        raise RuntimeError("GitHub archive index returned invalid JSON.") from error

    timestamps = [
        _parse_timestamp(year.get("last_timestamp"))
        for year in archive.get("years", [])
        if isinstance(year, dict)
    ]
    valid_timestamps = [timestamp for timestamp in timestamps if timestamp is not None]
    return max(valid_timestamps) if valid_timestamps else None


def find_active_workflow_run(token: str, urlopen=urllib.request.urlopen) -> dict | None:
    query = urllib.parse.urlencode({"branch": REF, "per_page": 20})
    endpoint = (
        f"https://api.github.com/repos/{OWNER}/{REPOSITORY}"
        f"/actions/workflows/{WORKFLOW}/runs?{query}"
    )
    request = _github_request(endpoint, token=token)
    status, body = _read_response(request, urlopen, "GitHub workflow runs request")
    if status != 200:
        raise RuntimeError(f"GitHub workflow runs returned unexpected status {status}")
    try:
        runs = json.loads(body).get("workflow_runs", [])
    except json.JSONDecodeError as error:
        raise RuntimeError("GitHub workflow runs returned invalid JSON.") from error
    return next((run for run in runs if run.get("status") in ACTIVE_RUN_STATUSES), None)


def dispatch_workflow(token: str, urlopen=urllib.request.urlopen) -> dict:
    endpoint = (
        f"https://api.github.com/repos/{OWNER}/{REPOSITORY}"
        f"/actions/workflows/{WORKFLOW}/dispatches"
    )
    request = _github_request(
        endpoint,
        token=token,
        data={
            "ref": REF,
            "inputs": {"force": True},
            "return_run_details": True,
        },
    )
    status, body = _read_response(request, urlopen, "GitHub workflow dispatch")
    response_body = body.decode("utf-8", errors="replace")
    if status not in {200, 204}:
        raise RuntimeError(
            f"GitHub workflow dispatch returned unexpected status {status}: {response_body[:500]}"
        )
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


def main_handler(event, context, urlopen=urllib.request.urlopen):
    token = os.environ.get("GITHUB_TOKEN", "").strip()
    if not token:
        raise RuntimeError("Missing required GITHUB_TOKEN environment variable.")

    source_timestamp = fetch_latest_mimic_timestamp(urlopen=urlopen)
    published_timestamp = fetch_published_timestamp(urlopen=urlopen)
    result = {
        "repository": f"{OWNER}/{REPOSITORY}",
        "workflow": WORKFLOW,
        "ref": REF,
        "source_latest_timestamp": _format_timestamp(source_timestamp),
        "published_latest_timestamp": (
            _format_timestamp(published_timestamp) if published_timestamp else None
        ),
        "checked_at": _format_timestamp(datetime.now(timezone.utc)),
        "trigger_type": event.get("Type") if isinstance(event, dict) else None,
        "request_id": getattr(context, "request_id", None),
    }

    if published_timestamp is not None and source_timestamp <= published_timestamp:
        result.update({"action": "up_to_date", "dispatched": False})
    else:
        active_run = find_active_workflow_run(token, urlopen=urlopen)
        if active_run:
            result.update(
                {
                    "action": "workflow_active",
                    "dispatched": False,
                    "active_run_id": active_run.get("id"),
                    "active_run_status": active_run.get("status"),
                    "active_run_url": active_run.get("html_url"),
                }
            )
        else:
            dispatch = dispatch_workflow(token, urlopen=urlopen)
            result.update(
                {
                    "action": "dispatched",
                    "dispatched": True,
                    "github_status": dispatch["status"],
                    "workflow_run_id": dispatch["workflow_run_id"],
                    "run_url": dispatch["run_url"],
                    "html_url": dispatch["html_url"],
                }
            )

    print(json.dumps(result, ensure_ascii=False))
    return result
