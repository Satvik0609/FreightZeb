"""
retrain_all.py
Retrains all 6 models using the original model classes.
Must be run from ml/service/ directory.
"""
import os, sys, time
os.chdir(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ".")

results = {}

def run(n, name, fn):
    print(f"\n{n}/6  {name}...")
    t0 = time.time()
    try:
        m = fn()
        elapsed = time.time() - t0
        results[name] = ("OK", elapsed)
        return m
    except Exception as e:
        elapsed = time.time() - t0
        results[name] = ("FAIL", str(e)[:120])
        print(f"     FAILED: {e}")
        return None

# 1 — TruckRecommender (use synthetic — DataCo encoding issue in class)
from models.truck_recommender_v2 import TruckRecommenderV2
m1 = run(1, "TruckRecommender", lambda: TruckRecommenderV2(use_real_data=False, force_retrain=True))
if m1: print(f"     accuracy={m1.accuracy:.4f}  cv={m1.cv_score:.4f}")

# 2 — DeliveryPredictor (use synthetic — food_delivery dataset wrong domain)
from models.delivery_predictor_v2 import DeliveryPredictorV2
m2 = run(2, "DeliveryPredictor", lambda: DeliveryPredictorV2(use_real_data=False, force_retrain=True))
if m2: print(f"     R2={m2.r2_score:.4f}  MAE={m2.mae:.2f}h")

# 3 — ShipmentClusterer (use real DataCo — has lat/lon)
from models.shipment_clusterer_v2 import ShipmentClustererV2
m3 = run(3, "ShipmentClusterer", lambda: ShipmentClustererV2(use_real_data=True, force_retrain=True))
if m3: print(f"     silhouette={m3.silhouette_score:.4f}")

# 4 — FuelEstimator (use real DataCo)
from models.fuel_estimator_v2 import FuelEstimatorV2
m4 = run(4, "FuelEstimator", lambda: FuelEstimatorV2(use_real_data=True, force_retrain=True))
if m4: print(f"     R2={m4.r2_score:.4f}  MAE={m4.mae:.2f}L")

# 5 — DelayPredictor (use real DataCo — patched to load it)
from models.delay_predictor_v2 import DelayPredictorV2
m5 = run(5, "DelayPredictor", lambda: DelayPredictorV2(use_real_data=True, force_retrain=True))
if m5: print(f"     accuracy={m5.accuracy:.4f}  roc_auc={m5.roc_auc:.4f}")

# 6 — RouteOptimizer (algorithm only)
from models.route_optimizer_v2 import RouteOptimizerV2
m6 = run(6, "RouteOptimizer", lambda: RouteOptimizerV2(force_retrain=True))
if m6: print(f"     avg_improvement={m6.avg_improvement:.1f}%")

print("\n" + "="*50)
print("RESULTS")
print("="*50)
for name, (status, info) in results.items():
    print(f"  {status}  {name}  {info if status=='FAIL' else ''}")
