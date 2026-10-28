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
