# FreightZen ML Models - Collaborator Guide

## 🎉 Welcome Collaborators!

All ML models are **pre-trained and ready to use**. You don't need to train anything!

---

## ⚡ Quick Start (3 Steps)

### Step 1: Clone Repository
```bash
git clone https://github.com/Satvik0609/FreightZen.git
cd FreightZen/ml-service
```

### Step 2: Install Dependencies
```bash
pip install -r requirements.txt
```

### Step 3: Verify Models Work
```bash
python verify_no_training.py
```

**Expected Output:**
```
✅ VERIFICATION COMPLETE
⏱️  Total Load Time: ~3 seconds
🎯 Training Required: NO
💾 Loaded From: Saved files

✅ ALL TESTS PASSED!
```

---

## 📦 What's Included

### Pre-trained Models (in `saved_models/`)

| Model | File | Size | Performance |
|-------|------|------|-------------|
| Truck Recommender V2 | `truck_recommender_v2.joblib` | 3.01 MB | 82.97% accuracy |
| Delivery Predictor V2 | `delivery_predictor_v2.joblib` | 3.12 MB | R²=0.9410 |
| Shipment Clusterer V2 | `shipment_clusterer_v2.joblib` | 0.28 MB | Silhouette=0.2431 |
| Fuel Estimator V2 | `fuel_estimator_v2.joblib` | 21.16 MB | R²=0.9729 |

**Total Size**: ~27.5 MB (compressed, included in Git)

---

## 💻 Usage Examples

### 1. Truck Recommendation
```python
from models.truck_recommender_v2 import TruckRecommenderV2

# Model loads instantly from saved file
model = TruckRecommenderV2()

# Make prediction
result = model.recommend(
    weight_kg=5000,
    volume_m3=15,
    distance_km=500,
    cargo_type="GENERAL",
    priority="HIGH"
)

print(f"Recommended: {result['recommended_truck']}")
print(f"Confidence: {result['confidence']:.3f}")
print(f"Model Accuracy: {result['model_accuracy']:.2%}")
```

### 2. Delivery Time Prediction
```python
from models.delivery_predictor_v2 import DeliveryPredictorV2

model = DeliveryPredictorV2()

result = model.predict(
    weight_kg=5000,
    distance_km=500,
    truck_type="CONTAINER_20FT",
    traffic_condition="MODERATE",
    weather_condition="CLEAR"
)

print(f"Predicted: {result['predicted_hours']:.2f} hours")
print(f"R² Score: {result['model_r2_score']:.4f}")
```

### 3. Shipment Clustering
```python
from models.shipment_clusterer_v2 import ShipmentClustererV2

model = ShipmentClustererV2()

shipments = [
    {'latitude': 40.7128, 'longitude': -74.0060, 'weight_kg': 5000, 'volume_m3': 15},
    {'latitude': 40.7580, 'longitude': -73.9855, 'weight_kg': 3000, 'volume_m3': 10},
    # ... more shipments
]

result = model.cluster(shipments)

print(f"Clusters: {result['n_clusters']}")
print(f"Silhouette Score: {result['silhouette_score']:.4f}")
```

### 4. Fuel Estimation
```python
from models.fuel_estimator_v2 import FuelEstimatorV2

model = FuelEstimatorV2()

result = model.estimate(
    distance_km=500,
    weight_kg=5000,
    truck_type="CONTAINER_20FT"
)

print(f"Fuel: {result['estimated_liters']:.2f} liters")
print(f"Cost: ${result['estimated_cost']:.2f}")
print(f"CO2: {result['co2_emissions_kg']:.2f} kg")
```

---

## ⏱️ Performance

- **Load Time**: < 3 seconds for all 4 models
- **Inference Time**: < 10ms per prediction
- **Memory Usage**: ~150 MB total
- **Training Time**: 0 seconds (pre-trained!)

---

## 🔧 No Training Required!

### Why You Don't Need to Train

1. ✅ **Models are pre-trained** on 10,000-20,000 samples
2. ✅ **Weights are saved** in `saved_models/` directory
3. ✅ **Automatically loaded** when you import the model
4. ✅ **Committed to Git** - available immediately after clone
5. ✅ **Production-ready** - tested and validated

### How It Works

```python
# When you do this:
from models.truck_recommender_v2 import TruckRecommenderV2
model = TruckRecommenderV2()

# Behind the scenes:
# 1. Check if saved model exists ✓
# 2. Load model from disk ✓
# 3. Skip training ✓
# 4. Ready to use! ✓
```

---

## 🔄 Optional: Retrain Models

If you want to retrain (not required):

### Option 1: Retrain Single Model
```python
from models.truck_recommender_v2 import TruckRecommenderV2

# Force retrain
model = TruckRecommenderV2(force_retrain=True)
```

### Option 2: Retrain All Models
```bash
python train_and_save_models.py
```

### Option 3: Use Real Kaggle Data
```bash
# 1. Setup Kaggle API (see REAL_DATA_SETUP.md)
# 2. Download datasets
python download_datasets.py

# 3. Train with real data
python -c "from models.truck_recommender_v2 import TruckRecommenderV2; TruckRecommenderV2(use_real_data=True, force_retrain=True)"
```

---

## 📊 Model Details

### Algorithms Used

- **XGBoost**: Gradient boosting for high accuracy
- **LightGBM**: Fast gradient boosting
- **CatBoost**: Categorical feature handling
- **Random Forest**: Ensemble learning
- **K-Means++**: Clustering
- **DBSCAN**: Density-based clustering

### Feature Engineering

Each model uses 9-12 engineered features:
- Log transformations
- Polynomial features
- Interaction terms
- Ratio features
- Distance calculations

---

## 🐛 Troubleshooting

### Issue: Models not loading
**Solution**: Ensure you're in `ml-service/` directory
```bash
cd ml-service
python verify_no_training.py
```

### Issue: Import errors
**Solution**: Install all dependencies
```bash
pip install -r requirements.txt
```

### Issue: "Model file not found"
**Solution**: Ensure you pulled the latest code
```bash
git pull origin feature/advanced-ml-implementation
```

### Issue: Want to see training logs
**Solution**: Set logging level
```python
import logging
logging.basicConfig(level=logging.INFO)
```

---

## 📚 Additional Resources

- **Model Documentation**: `saved_models/README.md`
- **Real Data Setup**: `REAL_DATA_SETUP.md`
- **Complete Summary**: `../ML_MODELS_SUMMARY.md`
- **API Testing**: `../API_TESTING.md`

---

## ✅ Verification Checklist

Before starting development, verify:

- [ ] Repository cloned
- [ ] Dependencies installed (`pip install -r requirements.txt`)
- [ ] Verification script passes (`python verify_no_training.py`)
- [ ] All 4 models load successfully
- [ ] Predictions work correctly

---

## 🎯 Summary

### What You Get
✅ 4 pre-trained ML models  
✅ No training required  
✅ Instant loading (< 3 seconds)  
✅ High accuracy (83-97%)  
✅ Production-ready code  
✅ Complete documentation  

### What You DON'T Need
❌ Training time  
❌ Large datasets  
❌ GPU  
❌ Complex setup  
❌ ML expertise  

---

## 🤝 Contributing

If you improve the models:

1. Train your improved model
2. It will automatically save to `saved_models/`
3. Commit the new `.joblib` file
4. Push to your branch
5. Create a pull request

---

## 📞 Support

- Check `verify_no_training.py` output
- Review `REAL_DATA_SETUP.md` for advanced usage
- See `ML_MODELS_SUMMARY.md` for complete details

---

**Welcome to FreightZen! Start building amazing logistics features! 🚀**
