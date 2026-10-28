from pathlib import Path
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
                [0.37614, 0.33029, 0.30237, 0.30458],
                [0.40645, 0.41506, 0.38604, 0.45475],
                [0.18779, 0.20851, 0.31601, 0.23034],
            ]
        )
        np.testing.assert_allclose(ratios[:, matlab_linear_indices], expected, atol=6e-5)


if __name__ == "__main__":
    unittest.main()
