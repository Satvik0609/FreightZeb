"""
check_datasets.py
=================
Verifies all required datasets are present and have the expected columns.
Fails with exit code 1 if anything is missing or malformed.

Run:
  cd ml/service
  python scripts/check_datasets.py
"""
import sys
import pathlib
import pandas as pd

ROOT     = pathlib.Path(__file__).parent.parent
DATA_DIR = ROOT / "data"

CHECKS = [
    {
        "name":    "DataCo Smart Supply Chain",
        "file":    DATA_DIR / "DataCoSupplyChainDataset.csv",
        "kaggle":  "shashwatwork/dataco-smart-supply-chain-for-big-data-analysis",
        "used_by": ["DelayPredictor"],
        "min_rows": 100_000,
        "required_columns": [
            "Late_delivery_risk",
            "Shipping Mode",
            "Order Item Quantity",
            "Order Item Product Price",
            "Department Name",
        ],
    },
    {
        "name":    "Olist Brazilian E-Commerce (orders)",
        "file":    DATA_DIR / "olist/olist_orders_dataset.csv",
        "kaggle":  "olistbr/brazilian-ecommerce",
        "used_by": ["ShipmentClusterer", "FuelEstimator"],
        "min_rows": 50_000,
        "required_columns": [
            "order_id",
            "customer_id",
            "order_status",
            "order_purchase_timestamp",
            "order_delivered_customer_date",
        ],
    },
    {
        "name":    "Olist Brazilian E-Commerce (order items)",
        "file":    DATA_DIR / "olist/olist_order_items_dataset.csv",
        "kaggle":  "olistbr/brazilian-ecommerce",
        "used_by": ["ShipmentClusterer", "FuelEstimator"],
        "min_rows": 50_000,
        "required_columns": ["order_id", "product_id", "price", "freight_value"],
    },
    {
        "name":    "VRP GA Dataset",
        "file":    DATA_DIR / "vrp_ga/VRP.csv",
        "kaggle":  "abhilashg23/vehicle-routing-problem-ga-dataset",
        "used_by": ["RouteOptimizer (benchmarking)"],
        "min_rows": 1_000,
        "required_columns": [
            "num_customers",
            "vehicle_capacity",
            "best_objective_value",
            "average_distance_depot",
        ],
    },
]

PASS = "\033[92m✓\033[0m"
FAIL = "\033[91m✗\033[0m"
WARN = "\033[93m⚠\033[0m"


def check_dataset(spec: dict) -> bool:
    path = spec["file"]
    name = spec["name"]

    print(f"\n  {name}")
    print(f"  Used by: {', '.join(spec['used_by'])}")

    if not path.exists():
        print(f"  {FAIL} MISSING: {path}")
        print(f"       Download from: https://www.kaggle.com/datasets/{spec['kaggle']}")
        print(f"       Place at:      {path}")
        return False

    size_mb = path.stat().st_size / 1_048_576
    print(f"  {PASS} File exists ({size_mb:.1f} MB)")

    try:
        df = pd.read_csv(path, nrows=5, encoding="latin-1")
    except Exception as e:
        print(f"  {FAIL} Cannot read CSV: {e}")
        return False

    missing_cols = [c for c in spec["required_columns"] if c not in df.columns]
    if missing_cols:
        print(f"  {FAIL} Missing columns: {missing_cols}")
        print(f"       Found columns:   {list(df.columns)[:10]}...")
        return False
    print(f"  {PASS} Required columns present")

    row_count = sum(1 for _ in open(path, encoding="latin-1")) - 1
    if row_count < spec["min_rows"]:
        print(f"  {WARN} Only {row_count:,} rows (expected ≥ {spec['min_rows']:,}) — file may be truncated")
    else:
        print(f"  {PASS} Row count OK ({row_count:,} rows)")

    return True


def main():
    print("=" * 55)
    print("  FreightZen ML — Dataset Readiness Check")
    print("=" * 55)

    passed = 0
    failed = 0

    for spec in CHECKS:
        ok = check_dataset(spec)
        if ok:
            passed += 1
        else:
            failed += 1

    print(f"\n{'=' * 55}")
    print(f"  {passed} / {len(CHECKS)} datasets ready")

    if failed > 0:
        print(f"  {FAIL} {failed} dataset(s) missing or malformed")
        print()
        print("  To download all datasets:")
        print("    cd ml/service")
        print("    python scripts/download_datasets.py")
        print()
        sys.exit(1)
    else:
        print(f"  {PASS} All datasets ready — safe to train")
        print()
        sys.exit(0)


if __name__ == "__main__":
    main()
