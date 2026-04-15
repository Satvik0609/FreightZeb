# Pre-trained ML Models

This directory contains pre-trained machine learning models for FreightZen.

## 📦 Available Models

### 1. Truck Recommender V2 (`truck_recommender_v2.joblib`)
- **Algorithm**: Ensemble (XGBoost + LightGBM)
- **Accuracy**: 82.97%
- **Cross-Validation**: 82.85%
- **Size**: ~3 MB
- **Features**: 10 engineered features
- **Training Data**: 15,000 synthetic samples

### 2. Delivery Predictor V2 (`delivery_predictor_v2.joblib`)
- **Algorithm**: Ensemble (XGBoost + CatBoost)
- **R² Score**: 0.9410
- **MAE**: 1.82 hours
- **RMSE**: 8.25 hours
- **Size**: ~3 MB
- **Features**: 12 engineered features
- **Training Data**: 20,000 synthetic samples

## 🚀 Usage

Models are automatically loaded when you import them:

```python
from models.truck_recommender_v2 import TruckRecommenderV2
from models.delivery_predictor_v2 import DeliveryPredictorV2

# Models load instantly from saved files - no training needed!
truck_model = TruckRecommenderV2()
delivery_model = DeliveryPredictorV2()

# Make predictions immediately
recommendation = truck_model.recommend(
    weight_kg=5000,
    volume_m3=15,
    distance_km=500
)
```

## 🔄 Retraining (Optional)

To retrain models with new data:

```python
# Force retrain
model = TruckRecommenderV2(force_retrain=True)

# Or run the training script
python train_and_save_models.py
```

## 📊 Model Performance

Both models achieve excellent performance:
- **Classification**: 83%+ accuracy with ensemble methods
- **Regression**: R² > 0.94 for delivery time prediction
- **Fast inference**: < 10ms per prediction
- **Compressed storage**: ~3MB per model

## 🔐 Git Handling

These model files are:
- Compressed using joblib (compression level 3)
- Binary files tracked in Git
- Small enough for regular Git (no LFS needed)
- Automatically loaded by collaborators

## 📝 Metadata

Each model file contains:
- Trained model objects (XGBoost, LightGBM, CatBoost)
- Preprocessing objects (scalers, encoders)
- Performance metrics
- Training date and configuration
- Feature engineering parameters

## 🤝 For Collaborators

When you clone this repository:
1. Models are already included
2. No training required
3. Just install dependencies: `pip install -r requirements.txt`
4. Run the service: `python main.py`
5. Models load in < 1 second

## 🔧 Troubleshooting

**Issue**: Model file not found
**Solution**: Run `python train_and_save_models.py` to regenerate

**Issue**: Version mismatch
**Solution**: Ensure you have the correct library versions from `requirements.txt`

**Issue**: Want to use real Kaggle data
**Solution**: See `REAL_DATA_SETUP.md` for instructions
