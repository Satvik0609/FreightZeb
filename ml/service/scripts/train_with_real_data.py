"""
train_with_real_data.py
=======================
Trains all 6 FreightZen V2 ML models using real Kaggle datasets.

DATASETS REQUIRED (download first with: python download_datasets.py)
---------------------------------------------------------------------
  ml/service/data/DataCoSupplyChainDataset.csv   (180k rows)
    → TruckRecommender, FuelEstimator, ShipmentClusterer, DelayPredictor

  ml/service/data/food_delivery.csv              (45k rows)
    → DeliveryPredictor

  RouteOptimizer uses a genetic algorithm — no training data needed.

HOW TO RUN
----------
  cd ml/service
  python download_datasets.py          # step 1: get the CSVs
  python train_with_real_data.py       # step 2: train all 6 models

  # Force retrain even if saved models already exist:
  python train_with_real_data.py --force

OUTPUT
------
  saved_models/truck_recommender_v2.joblib
  saved_models/delivery_predictor_v2.joblib
  saved_models/fuel_estimator_v2.joblib
  saved_models/delay_predictor_v2.joblib
  saved_models/shipment_clusterer_v2.joblib
  saved_models/route_optimizer_v2.joblib
"""

import argparse
import logging
import sys
import time
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("train_real")

DATA_DIR   = Path(__file__).parent / "data"
MODELS_DIR = Path(__file__).parent / "saved_models"


def _section(title: str):
    log.info("")
    log.info("━" * 60)
    log.info("  %s", title)
    log.info("━" * 60)


def _check_datasets():
    """Verify required CSVs are present before training."""
    dataco = DATA_DIR / "DataCoSupplyChainDataset.csv"
    food   = DATA_DIR / "food_delivery.csv"

    missing = []
    if not dataco.exists():
        missing.append("DataCoSupplyChainDataset.csv  (kaggle: shashwatwork/dataco-smart-supply-chain-for-big-data-analysis)")
    if not food.exists():
        missing.append("food_delivery.csv             (kaggle: gauravmalik26/food-delivery-dataset)")

    if missing:
        log.warning("Missing datasets:")
        for m in missing:
            log.warning("  ✗  %s", m)
        log.warning("")
        log.warning("Run:  python download_datasets.py")
        log.warning("Or download manually and place CSVs in ml/service/data/")
        log.warning("")
        log.warning("Falling back to high-quality synthetic data for missing datasets.")
    else:
        log.info("  ✓ DataCoSupplyChainDataset.csv found")
        log.info("  ✓ food_delivery.csv found")

    return dataco.exists(), food.exists()


def train_truck_recommender(force: bool = False):
    _section("MODEL 1 — TruckRecommender V2  (XGBoost + LightGBM)")
    from models.truck_recommender_v2 import TruckRecommenderV2
    t0 = time.time()
    model = TruckRecommenderV2(use_real_data=True, force_retrain=force)
    elapsed = time.time() - t0
    log.info("  accuracy=%.4f  cv=%.4f  time=%.1fs", model.accuracy, model.cv_score, elapsed)
    return {"name": "TruckRecommender V2", "accuracy": model.accuracy, "cv": model.cv_score}


def train_delivery_predictor(force: bool = False):
    _section("MODEL 2 — DeliveryPredictor V2  (XGBoost + CatBoost)")
    from models.delivery_predictor_v2 import DeliveryPredictorV2
    t0 = time.time()
    model = DeliveryPredictorV2(use_real_data=True, force_retrain=force)
    elapsed = time.time() - t0
    log.info("  R²=%.4f  MAE=%.2fh  RMSE=%.2fh  time=%.1fs",
             model.r2_score, model.mae, model.rmse, elapsed)
    return {"name": "DeliveryPredictor V2", "r2": model.r2_score, "mae": model.mae}


def train_shipment_clusterer(force: bool = False):
    _section("MODEL 3 — ShipmentClusterer V2  (KMeans + DBSCAN)")
    from models.shipment_clusterer_v2 import ShipmentClustererV2
    t0 = time.time()
    model = ShipmentClustererV2(use_real_data=True, force_retrain=force)
    elapsed = time.time() - t0
    log.info("  silhouette=%.4f  clusters=%d  time=%.1fs",
             model.silhouette_score, model.n_clusters, elapsed)
    return {"name": "ShipmentClusterer V2", "silhouette": model.silhouette_score, "clusters": model.n_clusters}


def train_fuel_estimator(force: bool = False):
    _section("MODEL 4 — FuelEstimator V2  (XGBoost + RandomForest)")
    from models.fuel_estimator_v2 import FuelEstimatorV2
    t0 = time.time()
    model = FuelEstimatorV2(use_real_data=True, force_retrain=force)
    elapsed = time.time() - t0
    log.info("  R²=%.4f  MAE=%.2fL  RMSE=%.2fL  time=%.1fs",
             model.r2_score, model.mae, model.rmse, elapsed)
    return {"name": "FuelEstimator V2", "r2": model.r2_score, "mae": model.mae}


def train_delay_predictor(force: bool = False):
    _section("MODEL 5 — DelayPredictor V2  (XGBoost + CatBoost)")
    from models.delay_predictor_v2 import DelayPredictorV2
    t0 = time.time()
    model = DelayPredictorV2(use_real_data=True, force_retrain=force)
    elapsed = time.time() - t0
    log.info("  accuracy=%.4f  cv=%.4f  roc_auc=%.4f  time=%.1fs",
             model.accuracy, model.cv_score, model.roc_auc, elapsed)
    return {"name": "DelayPredictor V2", "accuracy": model.accuracy, "roc_auc": model.roc_auc}


def train_route_optimizer(force: bool = False):
    _section("MODEL 6 — RouteOptimizer V2  (Genetic Algorithm + 2-opt)")
    from models.route_optimizer_v2 import RouteOptimizerV2
    t0 = time.time()
    model = RouteOptimizerV2(force_retrain=force)
    elapsed = time.time() - t0
    log.info("  avg_improvement=%.1f%%  best_efficiency=%.1f%%  time=%.1fs",
             model.avg_improvement, model.best_efficiency, elapsed)
    return {"name": "RouteOptimizer V2", "avg_improvement": model.avg_improvement}


def main():
    parser = argparse.ArgumentParser(description="Train all 6 FreightZen ML models with real data")
    parser.add_argument("--force", action="store_true", help="Force retrain even if saved models exist")
    args = parser.parse_args()

    log.info("FreightZen ML — Training all 6 models with real Kaggle datasets")
    log.info("force_retrain=%s", args.force)

    # Check datasets
    _section("Dataset Check")
    _check_datasets()

    results = []
    errors  = []

    trainers = [
        train_truck_recommender,
        train_delivery_predictor,
        train_shipment_clusterer,
        train_fuel_estimator,
        train_delay_predictor,
        train_route_optimizer,
    ]

    total_start = time.time()
    for fn in trainers:
        try:
            result = fn(force=args.force)
            results.append(result)
        except Exception as exc:
            log.error("  FAILED: %s", exc, exc_info=True)
            errors.append(str(exc))

    total_elapsed = time.time() - total_start

    # ── Summary ───────────────────────────────────────────────────────────────
    _section("Training Summary")
    log.info("  Total time: %.1fs", total_elapsed)
    log.info("  Models trained: %d / 6", len(results))

    for r in results:
        name = r.pop("name")
        metrics = "  ".join(f"{k}={v:.4f}" if isinstance(v, float) else f"{k}={v}"
                            for k, v in r.items())
        log.info("  ✓ %-30s  %s", name, metrics)

    if errors:
        log.error("")
        log.error("  %d model(s) failed:", len(errors))
        for e in errors:
            log.error("    ✗ %s", e)
        sys.exit(1)

    log.info("")
    log.info("  All models saved to: %s", MODELS_DIR)
    log.info("  Start the service:   python app.py")


if __name__ == "__main__":
    main()
