"""Python implementation of the MATLAB getP/getLPW LPW model."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from pathlib import Path

import numpy as np
import xgboost as xgb


@dataclass(frozen=True)
class LPWResult:
    low: np.ndarray
    middle: np.ndarray
    high: np.ndarray


class LPWModel:
    """Evaluate the PSHAX harmonic ratios and XGBoost residual correction."""

    def __init__(self, model_directory: Path, stride: int = 4) -> None:
        coefficients = np.load(model_directory / "pshax_coefficients.npz")
        grid = np.load(model_directory / "mimic_grid.npz")
        sample = (slice(None, None, stride), slice(None, None, stride))

        # MATLAB v7.3/HDF5 exposes the original cubes as harmonic, lat, lon.
        self.coefficients = np.stack(
            [
                coefficients["coeff_low"][(slice(None), *sample)],
                coefficients["coeff_mid"][(slice(None), *sample)],
                coefficients["coeff_high"][(slice(None), *sample)],
            ]
        ).astype(np.float32)
        self.latitude = grid["latitude"][sample].astype(np.float32)
        self.longitude = grid["longitude"][sample].astype(np.float32)
        self.elevation = grid["elevation"][sample].astype(np.float32)

        self.booster = xgb.Booster()
        self.booster.load_model(model_directory / "residual_model.ubj")

    @property
    def shape(self) -> tuple[int, int]:
        return self.latitude.shape

    def layer_ratios(self, day_of_year: int) -> np.ndarray:
        """Port of getP.m evaluated on the fixed MIMIC grid."""
        phase = (day_of_year / 365.25) * 2.0 * np.pi
        harmonics = np.asarray(
            [1.0, np.cos(phase), np.sin(phase), np.cos(2.0 * phase), np.sin(2.0 * phase)],
            dtype=np.float32,
        )
        return np.einsum("lhij,h->lij", self.coefficients, harmonics, optimize=True)

    def predict(self, tpw: np.ndarray, timestamp: datetime) -> LPWResult:
        """Port of getLPW.m: PSHAX initial layers plus learned residuals."""
        if tpw.shape != self.shape:
            raise ValueError(f"Expected TPW shape {self.shape}, received {tpw.shape}")

        day_of_year = timestamp.timetuple().tm_yday
        ratios = self.layer_ratios(day_of_year)
        features = np.column_stack(
            [
                self.latitude.ravel(),
                self.longitude.ravel(),
                self.elevation.ravel(),
                np.full(tpw.size, day_of_year, dtype=np.float32),
                tpw.astype(np.float32, copy=False).ravel(),
            ]
        )
        residuals = self.booster.inplace_predict(features).reshape((*self.shape, 3))
        layers = ratios * tpw[np.newaxis, :, :] + np.moveaxis(residuals, -1, 0)

        invalid = ~np.isfinite(tpw) | (tpw < 0)
        layers[:, invalid] = np.nan
        return LPWResult(low=layers[0], middle=layers[1], high=layers[2])
