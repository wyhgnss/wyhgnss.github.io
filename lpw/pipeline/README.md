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

When the R2 environment variables below are present, `update_data.py` evaluates
the LPW model once on the native 721 × 1440 MIMIC grid, uploads a compressed
NetCDF-4 product to Cloudflare R2, and then samples the same result every fourth
cell for the existing 1-degree browser frame.

Each NetCDF file contains one UTC analysis time and these packed `int16`
variables with a `0.01 mm` scale factor:

- `lpw_low`: surface–900 hPa.
- `lpw_middle`: 900–700 hPa.
- `lpw_high`: 700–300 hPa.

R2 object layout:

```text
mimic-lpw/
  manifest.json
  2026/
    manifest.json
    11/
      mimic_lpw_0p25_20261106T120000Z.nc
```

Required GitHub Actions secrets:

- `R2_ACCOUNT_ID`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- `R2_BUCKET`

Required GitHub Actions variable:

- `R2_PUBLIC_BASE_URL`, for example `https://data.wuyuhao.top`

Create an R2 token with **Object Read & Write** access limited to the archive
bucket. Connect the bucket to the public custom domain, then apply
`r2-cors.json` so the website can read annual manifests. If none of the R2
variables are present, the pipeline keeps publishing only the existing rolling
browser dataset. A partial R2 configuration is treated as an error.

The uploader maintains `lpw/data/mimic-archive.json` as a small same-origin copy
of the root archive index. The download page uses it to populate year and date
selectors, while NetCDF files and annual manifests remain in R2.

Run archive tests with:

```text
python -m unittest -v test_r2_archive.py
```
