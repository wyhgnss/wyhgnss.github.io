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
