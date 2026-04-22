"""
Train all ML models and save them for collaborators.
Run this once to generate pre-trained models that can be committed to Git.
"""

import logging
import sys
from pathlib import Path

logging.basicConfig(level=logging.INFO, format='%(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def train_all_models():
    """Train and save all ML models."""
    
    logger.info("\n" + "="*70)
    logger.info("FreightZen ML Models - Training & Saving for Collaborators")
    logger.info("="*70)
    
    models_trained = []
    
    # 1. Train Truck Recommender V2
    logger.info("\n📦 Training Truck Recommender V2...")
    try:
        from models.truck_recommender_v2 import TruckRecommenderV2
        model = TruckRecommenderV2(use_real_data=False, force_retrain=True)
        models_trained.append({
            'name': 'Truck Recommender V2',
            'accuracy': f"{model.accuracy:.2%}",
            'cv_score': f"{model.cv_score:.2%}",
            'status': '✅ SUCCESS'
        })
    except Exception as e:
        logger.error(f"❌ Failed: {e}")
        models_trained.append({
            'name': 'Truck Recommender V2',
            'status': f'❌ FAILED: {str(e)[:50]}'
        })
    
    # 2. Train Delivery Predictor V2
    logger.info("\n🚚 Training Delivery Predictor V2...")
    try:
        from models.delivery_predictor_v2 import DeliveryPredictorV2
        model = DeliveryPredictorV2(use_real_data=False, force_retrain=True)
        models_trained.append({
            'name': 'Delivery Predictor V2',
            'r2_score': f"{model.r2_score:.4f}",
            'mae': f"{model.mae:.2f}h",
            'status': '✅ SUCCESS'
        })
    except Exception as e:
        logger.error(f"❌ Failed: {e}")
        models_trained.append({
            'name': 'Delivery Predictor V2',
            'status': f'❌ FAILED: {str(e)[:50]}'
        })
    
    # 3. Train Shipment Clusterer V2
    logger.info("\n📍 Training Shipment Clusterer V2...")
    try:
        from models.shipment_clusterer_v2 import ShipmentClustererV2
        model = ShipmentClustererV2(use_real_data=False, force_retrain=True)
        models_trained.append({
            'name': 'Shipment Clusterer V2',
            'silhouette': f"{model.silhouette_score:.4f}",
            'clusters': f"{model.n_clusters}",
            'status': '✅ SUCCESS'
        })
    except Exception as e:
        logger.error(f"❌ Failed: {e}")
        models_trained.append({
            'name': 'Shipment Clusterer V2',
            'status': f'❌ FAILED: {str(e)[:50]}'
        })
    
    # 4. Train Fuel Estimator V2
    logger.info("\n⛽ Training Fuel Estimator V2...")
    try:
        from models.fuel_estimator_v2 import FuelEstimatorV2
        model = FuelEstimatorV2(use_real_data=False, force_retrain=True)
        models_trained.append({
            'name': 'Fuel Estimator V2',
            'r2_score': f"{model.r2_score:.4f}",
            'mae': f"{model.mae:.2f}L",
            'status': '✅ SUCCESS'
        })
    except Exception as e:
        logger.error(f"❌ Failed: {e}")
        models_trained.append({
            'name': 'Fuel Estimator V2',
            'status': f'❌ FAILED: {str(e)[:50]}'
        })
    
    # Summary
    logger.info("\n" + "="*70)
    logger.info("TRAINING SUMMARY")
    logger.info("="*70)
    
    for model_info in models_trained:
        logger.info(f"\n{model_info['name']}:")
        for key, value in model_info.items():
            if key != 'name':
                logger.info(f"  {key}: {value}")
    
    # Check saved models
    logger.info("\n" + "="*70)
    logger.info("SAVED MODELS")
    logger.info("="*70)
    
    from models.model_persistence import ModelPersistence
    saved_models = ModelPersistence.list_saved_models()
    
    if saved_models:
        for model in saved_models:
            logger.info(f"\n✓ {model['name']}")
            logger.info(f"  Size: {model['size_mb']} MB")
            logger.info(f"  Path: {model['path']}")
    else:
        logger.warning("No models saved!")
    
    # Instructions for collaborators
    logger.info("\n" + "="*70)
    logger.info("INSTRUCTIONS FOR COLLABORATORS")
    logger.info("="*70)
    logger.info("""
1. The trained models are saved in: ml-service/saved_models/
2. These files should be committed to Git (they're compressed)
3. When collaborators clone the repo, models load instantly
4. No retraining needed - just run: python main.py
5. Models are automatically loaded on first import

Model files:
  • truck_recommender_v2.joblib (~3-5 MB)
  • delivery_predictor_v2.joblib (~3-5 MB)
  • shipment_clusterer_v2.joblib (~2-3 MB)
  • fuel_estimator_v2.joblib (~2-3 MB)

To force retrain (optional):
  model = TruckRecommenderV2(force_retrain=True)
    """)
    
    logger.info("\n✅ All done! Models are ready for collaborators.")
    
    return len([m for m in models_trained if '✅' in m['status']])


if __name__ == "__main__":
    try:
        success_count = train_all_models()
        sys.exit(0 if success_count > 0 else 1)
    except Exception as e:
        logger.error(f"Training failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
