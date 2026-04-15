# FreightZen ML V2 Branch

This branch contains **only V2 models** - the best performing ML models with advanced algorithms (XGBoost, LightGBM, CatBoost).

---

## 🎯 Why This Branch?

This `ml_v2` branch is a clean, production-ready version that:
- ✅ **Uses only V2 models** (best performance)
- ✅ **Removes all V1 models** (legacy code eliminated)
- ✅ **Cleaner codebase** (no mixing of V1 and V2)
- ✅ **Better for production** (single source of truth)
- ✅ **Easier for collaborators** (no confusion about which models to use)

---

## 📊 V2 Models Included

| Model | Algorithm | Performance | Endpoint |
|-------|-----------|-------------|----------|
| Truck Recommender | XGBoost + LightGBM | 82.97% accuracy | `/predict-truck` |
| Delivery Predictor | XGBoost + CatBoost | R²=0.9410 | `/predict-delivery-time` |
| Shipment Clusterer | K-Means++ + DBSCAN | Silhouette=0.2431 | `/cluster-shipments` |
| Fuel Estimator | XGBoost + Random Forest | R²=0.9729 | `/estimate-fuel` |
| Delay Predictor | XGBoost + CatBoost | 80.80% accuracy | `/predict-delay-risk` |
| Route Optimizer | Genetic Algorithm + 2-opt | 42.2% improvement | `/optimize-route-v2` |

---

## 🚀 Quick Start

### 1. Clone and Setup
```bash
git clone https://github.com/Satvik0609/FreightZen.git
cd FreightZen
git checkout ml_v2
```

### 2. Install Dependencies
```bash
# Backend
cd backend
npm install

# Frontend
cd ../frontend
npm install

# ML Service
cd ../ml-service
pip install -r requirements.txt
```

### 3. Start Services
```bash
# Option 1: Use start script (Windows)
start.bat

# Option 2: Use start script (Linux/Mac)
./start.sh

# Option 3: Manual start
# Terminal 1 - Backend
cd backend
npm start

# Terminal 2 - Frontend
cd frontend
npm run dev

# Terminal 3 - ML Service
cd ml-service
python main.py
```

### 4. Verify Models
```bash
cd ml-service
python verify_all_v2_models.py
```

Expected output:
```
✅ VERIFICATION COMPLETE
⏱️  Total Load Time: 5.80 seconds
📊 Models Loaded: 6
🎯 Training Required: NO
✅ ALL TESTS PASSED!
```

---

## 📁 Project Structure

```
FreightZen/
├── backend/                 # Node.js + Express + Prisma
├── frontend/                # React + Vite + Tailwind
├── ml-service/              # Python + FastAPI + V2 Models ONLY
│   ├── models/
│   │   ├── truck_recommender_v2.py
│   │   ├── delivery_predictor_v2.py
│   │   ├── shipment_clusterer_v2.py
│   │   ├── fuel_estimator_v2.py
│   │   ├── delay_predictor_v2.py
│   │   ├── route_optimizer_v2.py
│   │   ├── neural_delivery_predictor.py (Advanced)
│   │   ├── route_optimizer.py (Advanced)
│   │   ├── predictive_maintenance.py (Advanced)
│   │   └── model_persistence.py
│   ├── saved_models/        # Pre-trained V2 models ONLY
│   │   ├── truck_recommender_v2.joblib
│   │   ├── delivery_predictor_v2.joblib
│   │   ├── shipment_clusterer_v2.joblib
│   │   ├── fuel_estimator_v2.joblib
│   │   ├── delay_predictor_v2.joblib
│   │   └── route_optimizer_v2.joblib
│   └── main.py              # FastAPI app (V2 only)
└── docker-compose.yml
```

---

## 🔥 Key Differences from Main Branch

| Feature | Main Branch | ml_v2 Branch |
|---------|-------------|--------------|
| V1 Models | ✅ Included | ❌ Removed |
| V2 Models | ✅ Included | ✅ Only These |
| Model Files | 11 models (5 V1 + 6 V2) | 6 models (V2 only) |
| Codebase | Mixed V1/V2 | Clean V2 only |
| Endpoints | Duplicate endpoints | Single clean endpoints |
| File Size | ~67 MB | ~35 MB |
| Complexity | Higher | Lower |
| Production Ready | Yes | Yes (Cleaner) |

---

## 🎯 API Endpoints

All endpoints use V2 models by default:

### Core ML Endpoints (V2)
- `POST /predict-truck` - Truck recommendation (82.97% accuracy)
- `POST /predict-delivery-time` - Delivery time prediction (R²=0.9410)
- `POST /cluster-shipments` - Shipment clustering (Silhouette=0.2431)
- `POST /estimate-fuel` - Fuel estimation (R²=0.9729)
- `POST /predict-delay-risk` - Delay risk prediction (80.80% accuracy)
- `POST /optimize-route-v2` - Route optimization (42.2% improvement)

### Advanced Features
- `POST /predict-delivery-neural` - Neural network delivery prediction
- `POST /optimize-route` - RL-based route optimization
- `POST /predict-maintenance` - Predictive maintenance
- `POST /optimize-cargo` - Cargo optimization

### Info Endpoints
- `GET /` - Service info
- `GET /health` - Health check
- `GET /models/info` - Model performance metrics

---

## 📊 Model Performance

All V2 models are pre-trained and load instantly:

```python
# Example: Truck Recommendation
from models.truck_recommender_v2 import TruckRecommenderV2

model = TruckRecommenderV2()  # Loads in < 1 second
result = model.recommend(
    weight_kg=15000,
    volume_m3=25,
    distance_km=500,
    cargo_type="GENERAL",
    priority="HIGH"
)

print(f"Recommended: {result['recommended_truck']}")
print(f"Confidence: {result['confidence']:.2%}")
print(f"Model Accuracy: {result['model_accuracy']:.2%}")
```

---

## 🔄 Retraining Models (Optional)

Models are pre-trained, but you can retrain if needed:

```bash
cd ml-service

# Retrain all V2 models
python train_and_save_models.py

# Verify after retraining
python verify_all_v2_models.py
```

---

## 🐳 Docker Deployment

```bash
# Build and start all services
docker-compose up --build

# Services will be available at:
# - Frontend: http://localhost:3000
# - Backend: http://localhost:5000
# - ML Service: http://localhost:8000
```

---

## 📚 Documentation

- **API Testing**: `API_TESTING.md`
- **V2 Models Guide**: `V2_MODELS_COMPLETE.md`
- **Production Ready**: `PRODUCTION_READY.md`
- **Collaborator Guide**: `ml-service/COLLABORATOR_GUIDE.md`
- **Setup Guide**: `SETUP.md`
- **Quick Start**: `QUICKSTART.md`

---

## 🤝 For Collaborators

### What You Get
1. ✅ Clean codebase with only V2 models
2. ✅ Pre-trained models (no training needed)
3. ✅ Fast loading (< 6 seconds)
4. ✅ High accuracy (81-97%)
5. ✅ Production-ready
6. ✅ No confusion about which models to use

### What You DON'T Need
1. ❌ Training time
2. ❌ Large datasets
3. ❌ GPU
4. ❌ Dealing with V1 legacy code

---

## 🎉 Summary

The `ml_v2` branch is the **recommended branch for production** because:
- ✅ **Best Performance**: Only the highest accuracy models
- ✅ **Clean Code**: No legacy V1 code
- ✅ **Smaller Size**: 35 MB vs 67 MB
- ✅ **Easier Maintenance**: Single source of truth
- ✅ **Better for Teams**: No confusion about which models to use

---

## 🔀 Branch Comparison

```bash
# Main branch (mixed V1 + V2)
git checkout feature/advanced-ml-implementation

# V2 only branch (recommended for production)
git checkout ml_v2
```

---

**Branch**: ml_v2  
**Models**: 6 V2 Models (Best Performance)  
**Status**: ✅ Production Ready  
**Recommended**: ✅ Yes

---

**Repository**: https://github.com/Satvik0609/FreightZen  
**Branch**: ml_v2  
**Last Updated**: 2026-04-15
