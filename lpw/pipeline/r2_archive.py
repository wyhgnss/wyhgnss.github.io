"""Create 0.25-degree LPW NetCDF products and archive them in Cloudflare R2."""

from __future__ import annotations

import hashlib
import json
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import numpy as np

from lpw_model import LPWResult


NETCDF_SCALE = 0.01
NETCDF_MISSING = -32768
PRODUCT_PREFIX = "mimic_lpw_0p25"


@dataclass(frozen=True)
class R2Config:
    account_id: str
    access_key_id: str
    secret_access_key: str
    bucket: str
    public_base_url: str
    prefix: str = "mimic-lpw"

    @property
    def endpoint_url(self) -> str:
        return f"https://{self.account_id}.r2.cloudflarestorage.com"

    @property
    def archive_base_url(self) -> str:
        return f"{self.public_base_url.rstrip('/')}/{self.prefix.strip('/')}/"

    @classmethod
    def from_environment(cls) -> R2Config | None:
        names = {
            "account_id": "R2_ACCOUNT_ID",
            "access_key_id": "R2_ACCESS_KEY_ID",
            "secret_access_key": "R2_SECRET_ACCESS_KEY",
            "bucket": "R2_BUCKET",
            "public_base_url": "R2_PUBLIC_BASE_URL",
        }
        values = {field: os.environ.get(name, "").strip() for field, name in names.items()}
        prefix = os.environ.get("R2_PREFIX", "mimic-lpw").strip().strip("/")
        if not any(values.values()):
            return None
        missing = [names[field] for field, value in values.items() if not value]
        if missing:
            raise RuntimeError(f"Incomplete R2 configuration; missing: {', '.join(missing)}")
        if not prefix:
            raise RuntimeError("R2_PREFIX must not be empty")
        return cls(**values, prefix=prefix)


def _axis_from_grid(grid: np.ndarray, axis: int) -> np.ndarray:
    if grid.ndim != 2:
        raise ValueError(f"Expected a two-dimensional coordinate grid, received {grid.shape}")
    values = grid[:, 0] if axis == 0 else grid[0, :]
    expanded = values[:, np.newaxis] if axis == 0 else values[np.newaxis, :]
    if not np.allclose(grid, expanded, atol=1e-6, equal_nan=False):
        name = "latitude" if axis == 0 else "longitude"
        raise ValueError(f"The {name} grid is not rectilinear")
    return values.astype(np.float32, copy=False)


def write_netcdf(
    path: Path,
    result: LPWResult,
    latitude_grid: np.ndarray,
    longitude_grid: np.ndarray,
    timestamp: datetime,
    source_url: str,
    model_version: str,
) -> None:
    """Write one CF-style NetCDF-4 product at the native 0.25-degree grid."""
    from netCDF4 import Dataset, date2num

    latitude = _axis_from_grid(latitude_grid, axis=0)
    longitude = _axis_from_grid(longitude_grid, axis=1)
    expected_shape = (latitude.size, longitude.size)
    for name, layer in (("low", result.low), ("middle", result.middle), ("high", result.high)):
        if layer.shape != expected_shape:
            raise ValueError(f"Expected {name} layer shape {expected_shape}, received {layer.shape}")

    path.parent.mkdir(parents=True, exist_ok=True)
    timestamp_utc = timestamp.astimezone(timezone.utc)
    chunk_rows = min(181, latitude.size)
    chunk_columns = min(360, longitude.size)

    with Dataset(path, "w", format="NETCDF4") as dataset:
        dataset.createDimension("time", 1)
        dataset.createDimension("latitude", latitude.size)
        dataset.createDimension("longitude", longitude.size)

        time_variable = dataset.createVariable("time", "f8", ("time",))
        time_variable.standard_name = "time"
        time_variable.long_name = "MIMIC analysis time"
        time_variable.units = "seconds since 1970-01-01 00:00:00 UTC"
        time_variable.calendar = "standard"
        time_variable[:] = date2num(timestamp_utc, time_variable.units, time_variable.calendar)

        latitude_variable = dataset.createVariable("latitude", "f4", ("latitude",))
        latitude_variable.standard_name = "latitude"
        latitude_variable.long_name = "latitude"
        latitude_variable.units = "degrees_north"
        latitude_variable.axis = "Y"
        latitude_variable[:] = latitude

        longitude_variable = dataset.createVariable("longitude", "f4", ("longitude",))
        longitude_variable.standard_name = "longitude"
        longitude_variable.long_name = "longitude"
        longitude_variable.units = "degrees_east"
        longitude_variable.axis = "X"
        longitude_variable[:] = longitude

        definitions = (
            ("lpw_low", "Layered precipitable water from the surface to 900 hPa", result.low),
            ("lpw_middle", "Layered precipitable water from 900 to 700 hPa", result.middle),
            ("lpw_high", "Layered precipitable water from 700 to 300 hPa", result.high),
        )
        for variable_name, long_name, values in definitions:
            variable = dataset.createVariable(
                variable_name,
                "i2",
                ("time", "latitude", "longitude"),
                fill_value=NETCDF_MISSING,
                zlib=True,
                complevel=6,
                shuffle=True,
                chunksizes=(1, chunk_rows, chunk_columns),
            )
            variable.standard_name = "atmosphere_mass_content_of_water_vapor"
            variable.long_name = long_name
            variable.units = "mm"
            variable.coordinates = "time latitude longitude"
            variable.scale_factor = np.float32(NETCDF_SCALE)
            variable.add_offset = np.float32(0.0)
            variable.grid_resolution = "0.25 degree"
            variable[0, :, :] = np.ma.masked_invalid(values.astype(np.float32, copy=False))

        dataset.Conventions = "CF-1.10"
        dataset.title = "Global 0.25-degree MIMIC layered precipitable water"
        dataset.summary = "Low-, middle-, and high-tropospheric LPW derived from MIMIC-TPW using the PSHAX plus residual-correction model."
        dataset.source = source_url
        dataset.model_version = model_version
        dataset.product_version = "1.0"
        dataset.time_coverage_start = timestamp_utc.isoformat().replace("+00:00", "Z")
        dataset.time_coverage_end = dataset.time_coverage_start
        dataset.geospatial_lat_min = float(latitude.min())
        dataset.geospatial_lat_max = float(latitude.max())
        dataset.geospatial_lon_min = float(longitude.min())
        dataset.geospatial_lon_max = float(longitude.max())
        dataset.geospatial_lat_resolution = 0.25
        dataset.geospatial_lon_resolution = 0.25
        dataset.history = f"Created {datetime.now(timezone.utc).isoformat().replace('+00:00', 'Z')}"


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(block)
    return digest.hexdigest()


def _missing_object(error: Exception) -> bool:
    response = getattr(error, "response", {})
    code = str(response.get("Error", {}).get("Code", ""))
    return code in {"404", "NoSuchKey", "NotFound"}


class R2Archive:
    def __init__(self, config: R2Config, client: Any | None = None) -> None:
        self.config = config
        if client is None:
            import boto3

            client = boto3.client(
                service_name="s3",
                endpoint_url=config.endpoint_url,
                aws_access_key_id=config.access_key_id,
                aws_secret_access_key=config.secret_access_key,
                region_name="auto",
            )
        self.client = client

    def _key(self, suffix: str) -> str:
        return f"{self.config.prefix.strip('/')}/{suffix.lstrip('/')}"

    def _read_json(self, key: str, fallback: dict) -> dict:
        try:
            response = self.client.get_object(Bucket=self.config.bucket, Key=key)
        except Exception as error:
            if _missing_object(error):
                return fallback
            raise
        body = response["Body"].read()
        return json.loads(body.decode("utf-8"))

    def _write_json(self, key: str, payload: dict) -> None:
        body = (json.dumps(payload, indent=2, sort_keys=False) + "\n").encode("utf-8")
        self.client.put_object(
            Bucket=self.config.bucket,
            Key=key,
            Body=body,
            ContentType="application/json; charset=utf-8",
            CacheControl="public, max-age=60, must-revalidate",
        )

    def upload_product(
        self,
        path: Path,
        timestamp: datetime,
        source_url: str,
        model_version: str,
        local_manifest_path: Path,
    ) -> dict:
        timestamp_utc = timestamp.astimezone(timezone.utc)
        year = timestamp_utc.year
        month = timestamp_utc.month
        stamp = timestamp_utc.strftime("%Y%m%dT%H%M%SZ")
        filename = f"{PRODUCT_PREFIX}_{stamp}.nc"
        relative_url = f"{month:02d}/{filename}"
        object_key = self._key(f"{year}/{relative_url}")
        size = path.stat().st_size
        checksum = file_sha256(path)

        with path.open("rb") as stream:
            self.client.put_object(
                Bucket=self.config.bucket,
                Key=object_key,
                Body=stream,
                ContentType="application/x-netcdf",
                ContentDisposition=f'attachment; filename="{filename}"',
                CacheControl="public, max-age=31536000, immutable",
                Metadata={"sha256": checksum, "model-version": model_version},
            )

        timestamp_text = timestamp_utc.isoformat().replace("+00:00", "Z")
        year_key = self._key(f"{year}/manifest.json")
        year_manifest = self._read_json(
            year_key,
            {
                "product": "MIMIC Layered Precipitable Water",
                "format": "NetCDF-4",
                "resolution_degrees": 0.25,
                "year": year,
                "files": [],
            },
        )
        entry = {
            "timestamp": timestamp_text,
            "date": timestamp_utc.strftime("%Y-%m-%d"),
            "url": relative_url,
            "bytes": size,
            "sha256": checksum,
            "model_version": model_version,
            "source_url": source_url,
        }
        files = {item["timestamp"]: item for item in year_manifest.get("files", [])}
        files[timestamp_text] = entry
        year_manifest["updated_at"] = datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        year_manifest["files"] = sorted(files.values(), key=lambda item: item["timestamp"])
        self._write_json(year_key, year_manifest)

        root_key = self._key("manifest.json")
        root_manifest = self._read_json(
            root_key,
            {
                "enabled": True,
                "product": "Global 0.25-degree MIMIC Layered Precipitable Water",
                "format": "NetCDF-4",
                "resolution_degrees": 0.25,
                "archive_base_url": self.config.archive_base_url,
                "years": [],
            },
        )
        first_timestamp = year_manifest["files"][0]["timestamp"]
        last_timestamp = year_manifest["files"][-1]["timestamp"]
        year_entry = {
            "year": year,
            "url": f"{year}/manifest.json",
            "file_count": len(year_manifest["files"]),
            "first_timestamp": first_timestamp,
            "last_timestamp": last_timestamp,
        }
        years = {int(item["year"]): item for item in root_manifest.get("years", [])}
        years[year] = year_entry
        root_manifest.update(
            {
                "enabled": True,
                "archive_base_url": self.config.archive_base_url,
                "updated_at": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
                "years": sorted(years.values(), key=lambda item: item["year"], reverse=True),
            }
        )
        self._write_json(root_key, root_manifest)
        local_manifest_path.parent.mkdir(parents=True, exist_ok=True)
        local_manifest_path.write_text(json.dumps(root_manifest, indent=2) + "\n", encoding="utf-8")
        return entry
