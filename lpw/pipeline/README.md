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

When the Tencent COS environment variables below are present, `update_data.py` evaluates
the LPW model once on the native 721 × 1440 MIMIC grid, uploads a compressed
NetCDF-4 product to Tencent Cloud Object Storage (COS), and then samples the same result every fourth
cell for the existing 1-degree browser frame.

Each NetCDF file contains one UTC analysis time and these packed `int16`
variables with a `0.01 mm` scale factor:

- `lpw_low`: surface–900 hPa.
- `lpw_middle`: 900–700 hPa.
- `lpw_high`: 700–300 hPa.

COS object layout:

```text
mimic-lpw/
  manifest.json
  2026/
    manifest.json
    11/
      mimic_lpw_0p25_20261106T120000Z.nc
```

Required GitHub Actions secrets (use a least-privilege CAM sub-user):

- `TENCENT_COS_SECRET_ID`
- `TENCENT_COS_SECRET_KEY`

Required GitHub Actions variables:

- `TENCENT_COS_BUCKET`, including the APPID suffix, for example `lpw-archive-1250000000`
- `TENCENT_COS_REGION`, for example `ap-guangzhou`

Optional GitHub Actions variable:

- `TENCENT_COS_PUBLIC_BASE_URL`; if omitted, the uploader uses the bucket's
  default `https://<bucket>.cos.<region>.myqcloud.com` domain.

Grant the CAM sub-user only `GetObject` and `PutObject` access under the
`mimic-lpw/*` prefix of the target bucket. The bucket must allow anonymous read
for those published objects (or use an equivalent bucket policy), because the
download page links directly to NetCDF files. In the bucket's **Security
Management > CORS** settings, allow `GET` and `HEAD` from
`https://wuyuhao.top` and `https://wyhgnss.github.io`. If none of the COS
variables are present, the pipeline keeps publishing only the existing rolling
browser dataset. A partial COS configuration is treated as an error.

The uploader maintains `lpw/data/mimic-archive.json` as a small same-origin copy
of the root archive index. The download page uses it to populate year and date
selectors, while NetCDF files and annual manifests remain in COS.

Run archive tests with:

```text
python -m unittest -v test_cos_archive.py
```
