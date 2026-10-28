"""Download recent MIMIC-TPW frames and publish browser-ready LPW grids."""

from __future__ import annotations

import argparse
import gzip
import io
import json
import re
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.parse import urljoin

import h5py
import numpy as np
import requests

from lpw_model import LPWModel


BASE_URL = "https://bin.ssec.wisc.edu/pub/mtpw2/data/"
FILE_PATTERN = re.compile(r'href="(comp(\d{8})\.(\d{2})0000\.nc)"')
MONTH_PATTERN = re.compile(r'href="(\d{6}/)"')
SCALE = 0.01
MISSING = -32768
SESSION = requests.Session()
SESSION.headers["User-Agent"] = "wyhgnss-lpw-monitor/1.0 (+https://wuyuhao.top/lpw/)"


def available_frames(hours: int) -> list[tuple[datetime, str]]:
    root = SESSION.get(BASE_URL, timeout=30)
    root.raise_for_status()
    months = MONTH_PATTERN.findall(root.text)[-2:]
    cutoff = datetime.now(timezone.utc) - timedelta(hours=hours + 6)
    frames: list[tuple[datetime, str]] = []
    for month in months:
        month_url = urljoin(BASE_URL, month)
        response = SESSION.get(month_url, timeout=30)
        response.raise_for_status()
        for filename, date_text, hour_text in FILE_PATTERN.findall(response.text):
            timestamp = datetime.strptime(date_text + hour_text, "%Y%m%d%H").replace(tzinfo=timezone.utc)
            if timestamp >= cutoff:
                frames.append((timestamp, urljoin(month_url, filename)))
    return sorted(set(frames))


def read_tpw(url: str, stride: int) -> np.ndarray:
    response = SESSION.get(url, timeout=120)
    response.raise_for_status()
    with h5py.File(io.BytesIO(response.content), "r") as dataset:
        return np.asarray(dataset["tpwGrid"][::stride, ::stride], dtype=np.float32)


def encode_layers(layers: tuple[np.ndarray, np.ndarray, np.ndarray]) -> bytes:
    quantized = []
    for layer in layers:
        values = np.rint(layer / SCALE)
        values = np.where(np.isfinite(values), np.clip(values, -32767, 32767), MISSING)
        quantized.append(values.astype("<i2"))
    raw = np.stack(quantized).tobytes(order="C")
    return gzip.compress(raw, compresslevel=9, mtime=0)


def load_manifest(path: Path) -> dict:
    if not path.exists():
        return {"frames": []}
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hours", type=int, default=72)
    parser.add_argument("--max-new", type=int, default=72)
    parser.add_argument("--stride", type=int, default=4, help="0.25 degree source cells per output cell")
    args = parser.parse_args()

    pipeline_directory = Path(__file__).resolve().parent
    site_directory = pipeline_directory.parent
    output_directory = site_directory / "data" / "frames"
    output_directory.mkdir(parents=True, exist_ok=True)
    manifest_path = site_directory / "data" / "manifest.json"
    manifest = load_manifest(manifest_path)
    known = {frame["timestamp"] for frame in manifest.get("frames", [])}

    candidates = available_frames(args.hours)
    pending = [(stamp, url) for stamp, url in candidates if stamp.isoformat().replace("+00:00", "Z") not in known]
    pending = pending[-args.max_new :]
    model = LPWModel(pipeline_directory / "model", stride=args.stride)
    new_frames = []

    for timestamp, source_url in pending:
        print(f"Processing {timestamp.isoformat()} from {source_url}")
        tpw = read_tpw(source_url, args.stride)
        result = model.predict(tpw, timestamp)
        stamp = timestamp.strftime("%Y%m%dT%H%M%SZ")
        filename = f"{stamp}.bin.gz"
        (output_directory / filename).write_bytes(encode_layers((result.low, result.middle, result.high)))
        new_frames.append(
            {
                "timestamp": timestamp.isoformat().replace("+00:00", "Z"),
                "url": f"frames/{filename}",
                "source_url": source_url,
            }
        )

    frames = manifest.get("frames", []) + new_frames
    if candidates:
        newest = candidates[-1][0]
        cutoff = newest - timedelta(hours=args.hours - 1)
        frames = [frame for frame in frames if datetime.fromisoformat(frame["timestamp"].replace("Z", "+00:00")) >= cutoff]
    frames.sort(key=lambda frame: frame["timestamp"])

    retained = {Path(frame["url"]).name for frame in frames}
    for old_file in output_directory.glob("*.bin.gz"):
        if old_file.name not in retained:
            old_file.unlink()

    rows, columns = model.shape
    payload = {
        "product": "MIMIC Layered Precipitable Water",
        "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
        "source": BASE_URL,
        "grid": {
            "rows": rows,
            "columns": columns,
            "latitude_start": -90.0,
            "latitude_step": 0.25 * args.stride,
            "longitude_start": -180.0,
            "longitude_step": 0.25 * args.stride,
            "scale": SCALE,
            "missing": MISSING,
            "source_resolution_degrees": 0.25,
            "display_resolution_degrees": 0.25 * args.stride,
        },
        "frames": frames,
    }
    manifest_path.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"Published {len(new_frames)} new frame(s); {len(frames)} retained.")


if __name__ == "__main__":
    main()
