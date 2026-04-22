"""
download_datasets.py
====================
Downloads the two Kaggle datasets used for training FreightZen ML models.

DATASETS
--------
1. DataCo Smart Supply Chain  (180k rows)
   kaggle: shashwatwork/dataco-smart-supply-chain-for-big-data-analysis
   Used by: TruckRecommender, FuelEstimator, ShipmentClusterer, DelayPredictor

2. Food Delivery Time Prediction  (45k rows)
   kaggle: gauravmalik26/food-delivery-dataset
   Used by: DeliveryPredictor

SETUP
-----
1. pip install kaggle
2. Get your API token from https://www.kaggle.com/account → "Create New API Token"
3. Place kaggle.json at:
     Windows : C:\\Users\\<you>\\.kaggle\\kaggle.json
     Linux   : ~/.kaggle/kaggle.json
4. python download_datasets.py

MANUAL ALTERNATIVE
------------------
Download the CSVs yourself and place them in ml/service/data/:
  data/DataCoSupplyChainDataset.csv
  data/food_delivery.csv
"""

import logging
import os
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format="%(levelname)s  %(message)s")
log = logging.getLogger(__name__)

DATA_DIR = Path(__file__).parent / "data"
DATA_DIR.mkdir(exist_ok=True)

DATASETS = [
    {
        "slug":     "shashwatwork/dataco-smart-supply-chain-for-big-data-analysis",
        "filename": "DataCoSupplyChainDataset.csv",
        "used_by":  "TruckRecommender, FuelEstimator, ShipmentClusterer, DelayPredictor",
    },
    {
        "slug":     "gauravmalik26/food-delivery-dataset",
        "filename": "food_delivery.csv",
        "used_by":  "DeliveryPredictor",
    },
]


def _check_already_downloaded() -> list[str]:
    missing = []
    for d in DATASETS:
        path = DATA_DIR / d["filename"]
        if path.exists():
            size_mb = path.stat().st_size / 1_048_576
            log.info("  ✓ already present: %s  (%.1f MB)", d["filename"], size_mb)
        else:
            missing.append(d)
    return missing


def download():
    log.info("Checking data directory: %s", DATA_DIR)
    missing = _check_already_downloaded()

    if not missing:
        log.info("All datasets already downloaded.")
        return

    try:
        import kaggle  # noqa: F401
    except ImportError:
        log.error("kaggle package not installed.  Run:  pip install kaggle")
        sys.exit(1)

    import kaggle as kg

    for d in missing:
        log.info("Downloading: %s", d["slug"])
        try:
            kg.api.dataset_download_files(d["slug"], path=str(DATA_DIR), unzip=True)
            # Kaggle sometimes names files differently — try to find and rename
            _normalise(d["filename"])
            log.info("  ✓ %s", d["filename"])
        except Exception as exc:
            log.error("  ✗ Failed: %s", exc)
            log.info(
                "  Manual download: https://www.kaggle.com/datasets/%s", d["slug"]
            )

    log.info("")
    log.info("Done. Now run:  python train_v3_models.py")


def _normalise(expected_name: str):
    """
    Kaggle sometimes extracts with a slightly different filename.
    Try common variants and rename to the expected name.
    """
    target = DATA_DIR / expected_name
    if target.exists():
        return

    variants = [
        expected_name.lower(),
        expected_name.replace("_", " "),
        expected_name.replace(".csv", "").lower() + ".csv",
    ]
    for f in DATA_DIR.iterdir():
        if f.suffix.lower() == ".csv" and (
            f.name in variants or f.name.lower() in variants
        ):
            f.rename(target)
            log.info("  renamed %s → %s", f.name, expected_name)
            return


if __name__ == "__main__":
    download()
