import json
import unittest
from datetime import datetime, timezone
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import patch

import numpy as np

from github_release_archive import generate_latest_release_product, release_download_url


class FakeResponse:
    def raise_for_status(self):
        return None

    def json(self):
        return {
            "year": 2026,
            "files": [
                {
                    "timestamp": "2026-11-07T08:00:00Z",
                    "date": "2026-11-07",
                    "url": "11/old.nc",
                    "bytes": 3,
                    "sha256": "old",
                }
            ],
        }


class FakeSession:
    def get(self, url, timeout):
        self.url = url
        return FakeResponse()


class FakeModel:
    def __init__(self, directory, stride):
        self.latitude = np.zeros((2, 2), dtype=np.float32)
        self.longitude = np.zeros((2, 2), dtype=np.float32)

    def predict(self, tpw, timestamp):
        return object()


class GitHubReleaseArchiveTest(unittest.TestCase):
    def test_release_download_url(self):
        self.assertEqual(
            release_download_url("mimic-lpw-2026-11", "product.nc"),
            "https://github.com/wyhgnss/wyhgnss.github.io/releases/download/mimic-lpw-2026-11/product.nc",
        )

    def test_imports_legacy_cos_index_and_adds_release_product(self):
        candidates = [
            (datetime(2026, 11, 7, 8, tzinfo=timezone.utc), "https://example/8.nc"),
            (datetime(2026, 11, 7, 9, tzinfo=timezone.utc), "https://example/9.nc"),
        ]

        with TemporaryDirectory() as directory:
            root = Path(directory)
            data = root / "data"
            output = root / "output"
            model = root / "model"
            data.mkdir()
            model.mkdir()
            (data / "mimic-archive.json").write_text(
                json.dumps(
                    {
                        "archive_base_url": "https://cos.example/mimic-lpw/",
                        "years": [{"year": 2026, "url": "2026/manifest.json"}],
                    }
                ),
                encoding="utf-8",
            )

            def fake_writer(path, result, latitude, longitude, timestamp, source_url, version):
                path.write_bytes(b"netcdf")

            with patch("github_release_archive.model_version", return_value="model123"):
                metadata = generate_latest_release_product(
                    data,
                    output,
                    model,
                    frame_source=lambda hours: candidates,
                    tpw_reader=lambda url, stride: np.zeros((2, 2), dtype=np.float32),
                    model_factory=FakeModel,
                    netcdf_writer=fake_writer,
                    session=FakeSession(),
                )

            manifest = json.loads((data / "mimic-releases" / "2026.json").read_text(encoding="utf-8"))
            self.assertEqual(len(manifest["files"]), 2)
            self.assertEqual(manifest["files"][0]["url"], "https://cos.example/mimic-lpw/2026/11/old.nc")
            self.assertIn("/releases/download/mimic-lpw-2026-11/", manifest["files"][1]["url"])
            self.assertEqual(metadata["release_tag"], "mimic-lpw-2026-11")


if __name__ == "__main__":
    unittest.main()
