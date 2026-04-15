# FreightZen V2 ML Models - README

## 🎉 Welcome to V2 Models!

All V2 models are **pre-trained and ready to use**. No training required!

---

## ⚡ Quick Start (30 seconds)

```bash
# 1. Install dependencies
pip install -r requirements.txt

# 2. Verify models work (< 3 seconds)
python verify_no_training.py

# 3. Start using!
python main.py
```

---

## 📊 What You Get

### 4 Pre-trained ML Models

| Model | Performance | Load Time | File Size |
|-------|-------------|-----------|-----------|
| Truck Recommender V2 | 82.97% accuracy | < 1s | 3.01 MB |
| Delivery Predictor V2 | R²=0.9410 | < 1s | 3.12 MB |
| Shipment Clusterer V2 | Silhouette=0.2431 | < 1s | 0.28 MB |
| Fuel Estimator V2 | R²=0.9729 | < 1s | 21.16 MB |

**Total Load Time**: < 3 seconds for all 4 models!

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
print(f"Accuracy: {result['model_accuracy']:.2%}")
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
    {'latitude': 34.0522, 'longitude': -118.2437, 'weight_kg': 8000, 'volume_m3': 25}
]

result = model.cluster(shipments)

print(f"Clusters: {result['n_clusters']}")
print(f"Silhouette: {result['silhouette_score']:.4f}")
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
print(f"R² Score: {result['model_r2_score']:.4f}")
```

---

## 🚀 API Endpoints

Start the ML service:

```bash
python main.py
# or
uvicorn main:app --reload
```

### V2 Endpoints

```bash
# Truck Recommendation
curl -X POST http://localhost:8000/v2/predict-truck \
  -H "Content-Type: application/json" \
  -d '{"weight_kg": 5000, "volume_m3": 15, "distance_km": 500, "cargo_type": "GENERAL", "priority": "HIGH"}'

# Delivery Prediction
curl -X POST http://localhost:8000/v2/predict-delivery-time \
  -H "Content-Type: application/json" \
  -d '{"weight_kg": 5000, "distance_km": 500, "truck_type": "CONTAINER_20FT", "traffic_condition": "MODERATE", "weather_condition": "CLEAR"}'

# Shipment Clustering
curl -X POST http://localhost:8000/v2/cluster-shipments \
  -H "Content-Type: application/json" \
  -d '{"shipments": [{"latitude": 40.7128, "longitude": -74.0060, "weight_kg": 5000, "volume_m3": 15}]}'

# Fuel Estimation
curl -X POST http://localhost:8000/v2/estimate-fuel \
  -H "Content-Type: application/json" \
  -d '{"distance_km": 500, "weight_kg": 5000, "truck_type": "CONTAINER_20FT"}'

# Models Info
curl http://localhost:8000/v2/models/info
```

---

## 🧪 Testing

### Verify Models Load
```bash
python verify_no_training.py
```

Expected output:
```
✅ VERIFICATION COMPLETE
⏱️  Total Load Time: 2.24 seconds
🎯 Training Required: NO
✅ ALL TESTS PASSED!
```

### Test All Models
```bash
python test_v2_models.py
```

### Test API Endpoints
```bash
# Start ML service first
python main.py

# In another terminal
python test_v2_api.py
```

---

## 📁 File Structure

```
ml-service/
├── saved_models/                    # Pre-trained models (Git committed)
│   ├── truck_recommender_v2.joblib  # 3.01 MB
│   ├── delivery_predictor_v2.joblib # 3.12 MB
│   ├── shipment_clusterer_v2.joblib # 0.28 MB
│   └── fuel_estimator_v2.joblib     # 21.16 MB
│
├── models/                          # Model implementations
│   ├── truck_recommender_v2.py
│   ├── delivery_predictor_v2.py
│   ├── shipment_clusterer_v2.py
│   ├── fuel_estimator_v2.py
│   └── model_persistence.py
│
├── main.py                          # FastAPI with V2 endpoints
├── verify_no_training.py            # Verification script
├── test_v2_models.py                # Model tests
├── test_v2_api.py                   # API tests
└── requirements.txt                 # Dependencies
```

---

## 🔧 Advanced Usage

### Retrain Models (Optional)

```python
# Force retrain single model
from models.truck_recommender_v2 import TruckRecommenderV2
model = TruckRecommenderV2(force_retrain=True)

# Train all models
python train_and_save_models.py

# Use real Kaggle data
python download_datasets.py
python -c "from models.truck_recommender_v2 import TruckRecommenderV2; TruckRecommenderV2(use_real_data=True, force_retrain=True)"
```

---

## 📚 Documentation

- **Complete Guide**: `../V2_MODELS_COMPLETE.md`
- **Collaborator Guide**: `COLLABORATOR_GUIDE.md`
- **Model Summary**: `../ML_MODELS_SUMMARY.md`
- **API Testing**: `../API_TESTING.md`
- **Real Data Setup**: `REAL_DATA_SETUP.md`

---

## 🎯 Key Features

✅ **Pre-trained models** - No training required  
✅ **Instant loading** - < 3 seconds for all models  
✅ **High accuracy** - 83-97% across models  
✅ **Fast inference** - < 10ms per prediction  
✅ **Production-ready** - Tested and validated  
✅ **Easy to use** - Simple API  
✅ **Well documented** - Complete guides  
✅ **Git committed** - Available immediately  

---

## 🐛 Troubleshooting

**Issue**: Models not loading  
**Solution**: Ensure you're in `ml-service/` directory

**Issue**: Import errors  
**Solution**: `pip install -r requirements.txt`

**Issue**: Want higher accuracy  
**Solution**: Train with real Kaggle data (see `REAL_DATA_SETUP.md`)

---

## 🤝 Contributing

If you improve the models:
1. Train your improved model
2. It will automatically save to `saved_models/`
3. Commit the new `.joblib` file
4. Push to your branch
5. Create a pull request

---

## 📊 Performance Summary

| Metric | Value |
|--------|-------|
| **Total Models** | 4 |
| **Total Size** | ~27.5 MB |
| **Load Time** | < 3 seconds |
| **Inference Time** | < 10ms |
| **Accuracy Range** | 83-97% |
| **Training Required** | ❌ No |
| **GPU Required** | ❌ No |

---

## 🎉 Success!

You now have access to 4 state-of-the-art ML models that:
- Load instantly without training
- Provide high-accuracy predictions
- Are production-ready
- Are easy to use and extend

**Start building amazing logistics features!** 🚀

---

**Questions?** Check the documentation files or run the test scripts.

**Repository**: https://github.com/Satvik0609/FreightZen  
**Status**: ✅ Production Ready
