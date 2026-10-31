from __future__ import annotations

import gzip
import json
from pathlib import Path
import unittest

import numpy as np


class GNSSBrowserExportTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls) -> None:
        data_directory = Path(__file__).resolve().parent.parent / "data" / "gnss"
        cls.manifest = json.loads((data_directory / "manifest.json").read_text(encoding="utf-8"))
        cls.raw = gzip.decompress((data_directory / "observations.bin.gz").read_bytes())

    def test_binary_layout_and_ranges(self) -> None:
        record_count = self.manifest["record_count"]
        padding = self.manifest["binary"]["padding_after_station"]
        station_offset = record_count * 2
        values_offset = station_offset + record_count + padding
        self.assertEqual(len(self.raw), values_offset + record_count * 6)

        times = np.frombuffer(self.raw, dtype="<u2", count=record_count, offset=0)
        stations = np.frombuffer(self.raw, dtype="u1", count=record_count, offset=station_offset)
        self.assertLess(int(times.max()), len(self.manifest["times"]))
        self.assertLess(int(stations.max()), len(self.manifest["stations"]))

    def test_offsets_match_sorted_time_index(self) -> None:
        record_count = self.manifest["record_count"]
        offsets = np.asarray(self.manifest["offsets"], dtype=np.int64)
        times = np.frombuffer(self.raw, dtype="<u2", count=record_count, offset=0)
        self.assertEqual(len(offsets), len(self.manifest["times"]) + 1)
        self.assertEqual(int(offsets[0]), 0)
        self.assertEqual(int(offsets[-1]), record_count)
        self.assertTrue(np.all(np.diff(offsets) >= 0))
        counts = np.bincount(times, minlength=len(self.manifest["times"]))
        np.testing.assert_array_equal(np.diff(offsets), counts)


if __name__ == "__main__":
    unittest.main()
