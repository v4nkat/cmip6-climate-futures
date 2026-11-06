# Five Futures for a Warming World

An interactive D3 visualization of CMIP6 global temperature projections for DSC 106 Project 3.

## Run locally

Because the project loads a local CSV, serve the directory over HTTP:

```bash
python3 -m http.server 8000
```

Then visit `http://localhost:8000`.

## Data

The visualization uses one ensemble member per CMIP6 model from the `cmip_temperatures` archive maintained by Mathias Hauser (ETH Zürich), licensed CC BY-SA 4.0. Temperature anomalies are relative to 1850–1900.

- Dataset DOI: <https://doi.org/10.5281/zenodo.5532894>
- Source repository: <https://github.com/mathause/cmip_temperatures>
- Local file: `cmip6_temperatures.csv`

The visualization retains only non-overlapping decadal periods and computes the median plus 10th and 90th percentiles within each scenario/period in the browser with D3.

## Deployment

The project is static and ready for GitHub Pages. Upload the files to a public repository and serve from the repository root.

## Before submitting

Replace the highlighted note in the Development process section with truthful team-member responsibilities and actual person-hours. These details cannot be inferred from the code.
