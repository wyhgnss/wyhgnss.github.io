import io
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
import unittest
from unittest.mock import patch

import numpy as np

try:
    from netCDF4 import Dataset
except ImportError:
    Dataset = None

from lpw_model import LPWResult
from r2_archive import R2Archive, R2Config, write_netcdf


class MissingObjectError(Exception):
    response = {"Error": {"Code": "NoSuchKey"}}


class FakeS3Client:
    def __init__(self) -> None:
        self.objects = {}
        self.metadata = {}

    def get_object(self, Bucket, Key):
        if (Bucket, Key) not in self.objects:
            raise MissingObjectError(Key)
        return {"Body": io.BytesIO(self.objects[(Bucket, Key)])}

    def put_object(self, Bucket, Key, Body, **kwargs):
        data = Body.read() if hasattr(Body, "read") else Body
        self.objects[(Bucket, Key)] = bytes(data)
        self.metadata[(Bucket, Key)] = kwargs
        return {"ETag": "test-etag"}


class NetCDFProductTest(unittest.TestCase):
    @unittest.skipIf(Dataset is None, "netCDF4 is not installed")
    def test_writes_packed_cf_product(self) -> None:
        latitude = np.repeat(np.asarray([[-90.0], [-89.75]], dtype=np.float32), 3, axis=1)
        longitude = np.repeat(np.asarray([[-180.0, -179.75, -179.5]], dtype=np.float32), 2, axis=0)
        low = np.asarray([[1.23, 2.34, np.nan], [4.56, 5.67, 6.78]], dtype=np.float32)
        result = LPWResult(low=low, middle=low + 1, high=low + 2)
        timestamp = datetime(2026, 11, 6, 12, tzinfo=timezone.utc)

        with TemporaryDirectory() as directory:
            path = Path(directory) / "product.nc"
            write_netcdf(path, result, latitude, longitude, timestamp, "https://example.test/source.nc", "model123")
            with Dataset(path) as dataset:
                self.assertEqual(dataset.Conventions, "CF-1.10")
                self.assertEqual(dataset.model_version, "model123")
                self.assertEqual(len(dataset.dimensions["latitude"]), 2)
                self.assertEqual(len(dataset.dimensions["longitude"]), 3)
                self.assertEqual(dataset.variables["lpw_low"].dtype, np.dtype("int16"))
                values = dataset.variables["lpw_low"][0]
                self.assertTrue(np.ma.getmaskarray(values)[0, 2])
                np.testing.assert_allclose(values[~values.mask], low[~np.isnan(low)], atol=0.011)


class R2ManifestTest(unittest.TestCase):
    def setUp(self) -> None:
        self.config = R2Config(
            account_id="account",
            access_key_id="access",
            secret_access_key="secret",
            bucket="lpw-archive",
            public_base_url="https://data.example.test",
        )
        self.client = FakeS3Client()
        self.archive = R2Archive(self.config, client=self.client)

    def test_uploads_products_and_builds_year_index(self) -> None:
        with TemporaryDirectory() as directory:
            directory_path = Path(directory)
            product = directory_path / "product.nc"
            product.write_bytes(b"netcdf-test-data")
            local_manifest = directory_path / "mimic-archive.json"

            self.archive.upload_product(
                product,
                datetime(2026, 1, 2, 3, tzinfo=timezone.utc),
                "https://example.test/one.nc",
                "model123",
                local_manifest,
            )
            self.archive.upload_product(
                product,
                datetime(2026, 2, 3, 4, tzinfo=timezone.utc),
                "https://example.test/two.nc",
                "model123",
                local_manifest,
            )

            year_key = ("lpw-archive", "mimic-lpw/2026/manifest.json")
            year_manifest = json.loads(self.client.objects[year_key])
            self.assertEqual(len(year_manifest["files"]), 2)
            self.assertEqual(year_manifest["files"][0]["date"], "2026-01-02")
            self.assertEqual(year_manifest["files"][1]["url"], "02/mimic_lpw_0p25_20260203T040000Z.nc")

            root_manifest = json.loads(local_manifest.read_text(encoding="utf-8"))
            self.assertTrue(root_manifest["enabled"])
            self.assertEqual(root_manifest["archive_base_url"], "https://data.example.test/mimic-lpw/")
            self.assertEqual(root_manifest["years"][0]["file_count"], 2)

    def test_environment_configuration_is_optional_but_not_partial(self) -> None:
        names = [
            "R2_ACCOUNT_ID",
            "R2_ACCESS_KEY_ID",
            "R2_SECRET_ACCESS_KEY",
            "R2_BUCKET",
            "R2_PUBLIC_BASE_URL",
            "R2_PREFIX",
        ]
        with patch.dict(os.environ, {name: "" for name in names}, clear=False):
            self.assertIsNone(R2Config.from_environment())
        with patch.dict(os.environ, {"R2_ACCOUNT_ID": "account"}, clear=True):
            with self.assertRaisesRegex(RuntimeError, "Incomplete R2 configuration"):
                R2Config.from_environment()


if __name__ == "__main__":
    unittest.main()
