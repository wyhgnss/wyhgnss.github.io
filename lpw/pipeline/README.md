# LPW data pipeline

This directory is the Python replacement for the MATLAB `getP` and `getLPW`
workflow. `update_data.py` discovers recent hourly MIMIC-TPW NetCDF files,
evaluates the harmonic layer ratios and XGBoost residual model, and writes the
three-day rolling browser dataset into `../data/`.

Run locally from this directory with:

```bash
python -m pip install -r requirements.txt
python update_data.py --hours 72
```

The display product is sampled at 1 degree from the original 0.25-degree MIMIC
grid. All model calculations for each published pixel use the original
coefficients, terrain height, day of year, and TPW value.

The model artifacts total about 91 MB and will be public when pushed to this
public GitHub Pages repository. Do not push them if the trained model or
coefficients must remain private; use a private data-processing repository and
publish only `lpw/data/` instead.

## Historical GNSS LPW export

`export_gnss_history.m` converts the historical `GNSSLPW.mat` vectors into the
compact static archive used by the browser. Run it in MATLAB with explicit
source and output paths:

```matlab
export_gnss_history( ...
    "H:\LPW模型\GNSSLPW.mat", ...
    "C:\Users\Administrator\Documents\GitHub\wyhgnss.github.io\lpw\data\gnss")
```

The exporter validates vector lengths and station-number mappings, removes
identical duplicate time-station rows, sorts the sparse observations by time,
and writes `manifest.json` plus `observations.bin.gz`. Missing stations are
represented by absent sparse rows rather than fabricated values. The dataset
time zone is not specified in the source MATLAB datetime vector, so the web UI
labels it as dataset time rather than UTC.

Validate the generated archive from this directory with:

```bash
python -m unittest -v test_gnss_export.py
```

## Global 0.25-degree MIMIC LPW NetCDF archive

GitHub Actions generates the native-grid NetCDF product and uploads it as an
asset of a monthly GitHub Release. Binary products are deliberately not
committed to the Git branch: Git history would grow by roughly 25 GB per year
and deleting old working-tree files would not remove their historical objects.

Each NetCDF file contains one UTC analysis time and these packed `int16`
variables with a `0.01 mm` scale factor:

- `lpw_low`: surface–900 hPa.
- `lpw_middle`: 900–700 hPa.
- `lpw_high`: 700–300 hPa.

Release layout:

```text
Release tag: mimic-lpw-2026-11
  mimic_lpw_0p25_20261106T120000Z.nc
  mimic_lpw_0p25_20261106T130000Z.nc
```

Each month uses a separate release so the asset count remains below GitHub's
per-release limit. `github_release_archive.py` imports the existing Tencent COS
annual manifest on its first run, preserving links to products already stored
there, and adds new GitHub Release download URLs afterwards.

The small indexes remain in Git and are published by GitHub Pages:

```text
lpw/data/mimic-archive.json
lpw/data/mimic-releases/2026.json
```

The download page reads these same-origin indexes and links directly to public
release assets. The workflow needs only its built-in `GITHUB_TOKEN` with
`contents: write`; Tencent COS secrets and variables are no longer used.

Run archive tests with:

```text
python -m unittest -v test_github_release_archive.py test_cos_archive.py
```
