"""
Train and save the remaining 2 V2 models:
- Delay Predictor V2
- Route Optimizer V2
"""

import logging
import time

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)

print("\n" + "="*70)
print("Training Remaining V2 Models")
print("="*70)

start_time = time.time()

# Train Delay Predictor V2
print("\n1️⃣  Training Delay Predictor V2...")
print("   Algorithm: XGBoost + CatBoost Ensemble")
from models.delay_predictor_v2 import DelayPredictorV2
delay_model = DelayPredictorV2(force_retrain=True)
print(f"   ✅ Accuracy: {delay_model.accuracy:.2%}")
print(f"   ✅ CV Score: {delay_model.cv_score:.2%}")
print(f"   ✅ ROC AUC: {delay_model.roc_auc:.4f}")

# Train Route Optimizer V2
print("\n2️⃣  Initializing Route Optimizer V2...")
print("   Algorithm: Genetic Algorithm + 2-opt")
from models.route_optimizer_v2 import RouteOptimizerV2
route_model = RouteOptimizerV2(force_retrain=True)
print(f"   ✅ Avg Improvement: {route_model.avg_improvement:.1f}%")
print(f"   ✅ Best Efficiency: {route_model.best_efficiency:.1f}%")

training_time = time.time() - start_time

print("\n" + "="*70)
print("✅ Training Complete!")
print("="*70)
print(f"\n⏱️  Total Training Time: {training_time:.2f} seconds")
print(f"📊 Models Trained: 2")
print(f"💾 Models Saved: saved_models/")

print("\n📈 Model Performance:")
print(f"   • Delay Predictor V2: {delay_model.accuracy:.2%} accuracy")
print(f"   • Route Optimizer V2: {route_model.avg_improvement:.1f}% avg improvement")

print("\n🎉 All V2 models are now ready for production!")
print("   Run 'python verify_all_v2_models.py' to verify all 6 models.\n")
