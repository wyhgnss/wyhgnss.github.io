"""Generate MIMIC LPW NetCDF files for storage as GitHub Release assets."""

from __future__ import annotations

import argparse
import hashlib
import json
import os
from datetime import timezone
from pathlib import Path
from netcdf_product import PRODUCT_PREFIX, write_netcdf
from lpw_model import LPWModel
from update_data import available_frames, model_version, read_tpw


OWNER = "wyhgnss"
REPOSITORY = "wyhgnss.github.io"


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def release_tag(timestamp) -> str:
    return timestamp.astimezone(timezone.utc).strftime("mimic-lpw-%Y-%m")


def release_download_url(tag: str, filename: str) -> str:
    return f"https://github.com/{OWNER}/{REPOSITORY}/releases/download/{tag}/{filename}"


def load_json(path: Path, fallback: dict) -> dict:
    if not path.exists():
        return fallback
    return json.loads(path.read_text(encoding="utf-8"))


def load_year_manifest(data_directory: Path, year: int) -> dict:
    path = data_directory / "mimic-releases" / f"{year}.json"
    if path.exists():
        return load_json(path, {"year": year, "files": []})
    return {"year": year, "files": []}


def save_manifests(data_directory: Path, root: dict, year_manifest: dict) -> None:
    year = int(year_manifest["year"])
    files = sorted(year_manifest.get("files", []), key=lambda item: item["timestamp"])
    year_manifest["files"] = files
    year_path = data_directory / "mimic-releases" / f"{year}.json"
    year_path.parent.mkdir(parents=True, exist_ok=True)
    year_path.write_text(json.dumps(year_manifest, indent=2) + "\n", encoding="utf-8")

    year_entry = {
        "year": year,
        "url": f"mimic-releases/{year}.json",
        "file_count": len(files),
        "first_timestamp": files[0]["timestamp"],
        "last_timestamp": files[-1]["timestamp"],
    }
    years = {int(item["year"]): item for item in root.get("years", [])}
    years[year] = year_entry
    root.update(
        {
            "enabled": True,
            "storage": "github-releases",
            "product": "Global 0.25-degree MIMIC Layered Precipitable Water",
            "format": "NetCDF-4",
            "resolution_degrees": 0.25,
            "archive_base_url": "",
            "updated_at": year_manifest["updated_at"],
            "years": sorted(years.values(), key=lambda item: item["year"], reverse=True),
        }
    )
    (data_directory / "mimic-archive.json").write_text(
        json.dumps(root, indent=2) + "\n", encoding="utf-8"
    )


def generate_latest_release_product(
    data_directory: Path,
    output_directory: Path,
    model_directory: Path,
    hours: int = 96,
    frame_source=available_frames,
    tpw_reader=read_tpw,
    model_factory=LPWModel,
    netcdf_writer=write_netcdf,
) -> dict | None:
    root_path = data_directory / "mimic-archive.json"
    root = load_json(root_path, {"years": []})
    candidates = frame_source(hours)
    if not candidates:
        raise RuntimeError("The MIMIC source did not publish any candidate frames.")

    manifests = {
        year: load_year_manifest(data_directory, year)
        for year in {timestamp.year for timestamp, _ in candidates}
    }
    known = {
        item["timestamp"]
        for manifest in manifests.values()
        for item in manifest.get("files", [])
        if item.get("timestamp")
    }
    pending = [
        item
        for item in candidates
        if item[0].astimezone(timezone.utc).isoformat().replace("+00:00", "Z") not in known
    ]
    if not pending:
        print("GitHub Releases already contain the newest available MIMIC product.")
        return None

    timestamp, source_url = pending[-1]
    active_model_version = model_version(model_directory)
    model = model_factory(model_directory, stride=1)
    print(f"Processing {timestamp.isoformat()} from {source_url}")
    result = model.predict(tpw_reader(source_url, 1), timestamp)
    stamp = timestamp.astimezone(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    filename = f"{PRODUCT_PREFIX}_{stamp}.nc"
    output_directory.mkdir(parents=True, exist_ok=True)
    path = output_directory / filename
    netcdf_writer(
        path,
        result,
        model.latitude,
        model.longitude,
        timestamp,
        source_url,
        active_model_version,
    )

    timestamp_text = timestamp.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
    tag = release_tag(timestamp)
    entry = {
        "timestamp": timestamp_text,
        "date": timestamp_text[:10],
        "url": release_download_url(tag, filename),
        "bytes": path.stat().st_size,
        "sha256": sha256(path),
        "model_version": active_model_version,
        "source_url": source_url,
        "release_tag": tag,
    }
    year_manifest = manifests[timestamp.year]
    year_manifest.update(
        {
            "product": "MIMIC Layered Precipitable Water",
            "format": "NetCDF-4",
            "resolution_degrees": 0.25,
            "year": timestamp.year,
            "updated_at": timestamp_text,
        }
    )
    files = {item["timestamp"]: item for item in year_manifest.get("files", [])}
    files[timestamp_text] = entry
    year_manifest["files"] = list(files.values())
    save_manifests(data_directory, root, year_manifest)

    metadata = {"asset_path": str(path.resolve()), "release_tag": tag, "entry": entry}
    metadata_path = output_directory / "release-upload.json"
    metadata_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")
    print(f"Prepared {filename} ({entry['bytes']:,} bytes) for GitHub Release {tag}.")
    return metadata


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--hours", type=int, default=96)
    parser.add_argument("--output-directory", type=Path, required=True)
    args = parser.parse_args()
    pipeline_directory = Path(__file__).resolve().parent
    data_directory = pipeline_directory.parent / "data"
    metadata = generate_latest_release_product(
        data_directory,
        args.output_directory,
        pipeline_directory / "model",
        hours=args.hours,
    )
    if metadata is None:
        (args.output_directory / "release-upload.json").parent.mkdir(parents=True, exist_ok=True)
        (args.output_directory / "release-upload.json").write_text(
            json.dumps({"asset_path": "", "release_tag": ""}) + "\n", encoding="utf-8"
        )


if __name__ == "__main__":
    main()
