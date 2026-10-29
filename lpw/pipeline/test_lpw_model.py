from pathlib import Path
from datetime import datetime, timezone
import unittest

import numpy as np

from lpw_model import LPWModel


class MATLABParityTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        cls.model = LPWModel(Path(__file__).parent / "model", stride=1)

    def test_getp_matches_matlab_reference_points(self) -> None:
        ratios = self.model.layer_ratios(301).reshape(3, -1)
        matlab_linear_indices = np.asarray([1, 123456, 500000, 1038240]) - 1
        expected = np.asarray(
            [
                [0.3771455, 0.32452303, 0.3085152, 0.3079579],
                [0.40280944, 0.4153329, 0.39051422, 0.4565291],
                [0.19019069, 0.21388584, 0.305676, 0.22536495],
            ]
        )
        np.testing.assert_allclose(ratios[:, matlab_linear_indices], expected, atol=6e-5)

    def test_updated_residual_model_runs_on_cpu_grid(self) -> None:
        model = LPWModel(Path(__file__).parent / "model", stride=4)
        tpw = np.full(model.shape, 20.0, dtype=np.float32)
        result = model.predict(tpw, datetime(2026, 10, 29, tzinfo=timezone.utc))
        for layer in (result.low, result.middle, result.high):
            self.assertEqual(layer.shape, model.shape)
            self.assertTrue(np.isfinite(layer).all())


if __name__ == "__main__":
    unittest.main()
