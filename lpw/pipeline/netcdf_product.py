"""Write global 0.25-degree MIMIC LPW NetCDF products."""

from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path

import numpy as np

from lpw_model import LPWResult


NETCDF_SCALE = 0.01
NETCDF_MISSING = -32768
PRODUCT_PREFIX = "mimic_lpw_0p25"


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
            valid = np.isfinite(values)
            packed = np.full(values.shape, NETCDF_MISSING, dtype=np.int16)
            scaled = np.rint(values[valid] / NETCDF_SCALE)
            if np.any(scaled < np.iinfo(np.int16).min + 1) or np.any(scaled > np.iinfo(np.int16).max):
                raise ValueError(f"{variable_name} contains values outside the packed int16 range")
            packed[valid] = scaled.astype(np.int16)
            variable.set_auto_maskandscale(False)
            variable[0, :, :] = packed

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
