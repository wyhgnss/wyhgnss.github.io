from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest

import numpy as np

try:
    from netCDF4 import Dataset
except ImportError:
    Dataset = None

from lpw_model import LPWResult
from netcdf_product import write_netcdf


class NetCDFProductTest(unittest.TestCase):
    @unittest.skipIf(Dataset is None, "netCDF4 is not installed")
    def test_writes_packed_cf_product(self) -> None:
        latitude = np.repeat(np.asarray([[-90.0], [-89.75]], dtype=np.float32), 3, axis=1)
        longitude = np.repeat(np.asarray([[-180.0, -179.75, -179.5]], dtype=np.float32), 2, axis=0)
        low = np.asarray([[1.23, 2.34, np.nan], [4.56, 5.67, 6.78]], dtype=np.float32)
        result = LPWResult(low=low, middle=low + 1, high=low + 2)

        with TemporaryDirectory() as directory:
            path = Path(directory) / "product.nc"
            write_netcdf(
                path,
                result,
                latitude,
                longitude,
                datetime(2026, 11, 6, 12, tzinfo=timezone.utc),
                "https://example.test/source.nc",
                "model123",
            )
            with Dataset(path) as dataset:
                self.assertEqual(dataset.Conventions, "CF-1.10")
                self.assertEqual(dataset.model_version, "model123")
                self.assertEqual(len(dataset.dimensions["latitude"]), 2)
                self.assertEqual(len(dataset.dimensions["longitude"]), 3)
                self.assertEqual(dataset.variables["lpw_low"].dtype, np.dtype("int16"))
                values = dataset.variables["lpw_low"][0]
                self.assertTrue(np.ma.getmaskarray(values)[0, 2])
                np.testing.assert_allclose(values[~values.mask], low[~np.isnan(low)], atol=0.011)


if __name__ == "__main__":
    unittest.main()
