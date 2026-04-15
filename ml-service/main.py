from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from typing import Optional, List
import logging

from models.truck_recommender import TruckRecommender
from models.delivery_predictor import DeliveryPredictor
from models.neural_delivery_predictor import NeuralDeliveryPredictor
from models.shipment_clusterer import ShipmentClusterer
from models.delay_predictor import DelayPredictor
from models.fuel_estimator import FuelEstimator
from models.route_optimizer import RouteOptimizer
from models.predictive_maintenance import PredictiveMaintenanceModel
from optimization.cargo_optimizer import CargoOptimizer

# V2 Models - Advanced ML with pre-trained weights
from models.truck_recommender_v2 import TruckRecommenderV2
from models.delivery_predictor_v2 import DeliveryPredictorV2
from models.shipment_clusterer_v2 import ShipmentClustererV2
from models.fuel_estimator_v2 import FuelEstimatorV2
from models.delay_predictor_v2 import DelayPredictorV2
from models.route_optimizer_v2 import RouteOptimizerV2

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

app = FastAPI(title="FreightZen ML Service - Advanced Edition", version="2.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

truck_recommender = TruckRecommender()
delivery_predictor = DeliveryPredictor()
neural_delivery_predictor = NeuralDeliveryPredictor()
shipment_clusterer = ShipmentClusterer()
delay_predictor = DelayPredictor()
fuel_estimator = FuelEstimator()
route_optimizer = RouteOptimizer()
predictive_maintenance = PredictiveMaintenanceModel()
cargo_optimizer = CargoOptimizer()

# V2 Models - Load pre-trained models instantly
logger.info("Loading V2 models with pre-trained weights...")
truck_recommender_v2 = TruckRecommenderV2()
delivery_predictor_v2 = DeliveryPredictorV2()
shipment_clusterer_v2 = ShipmentClustererV2()
fuel_estimator_v2 = FuelEstimatorV2()
delay_predictor_v2 = DelayPredictorV2()
route_optimizer_v2 = RouteOptimizerV2()
logger.info("✅ All 6 V2 models loaded successfully!")


class TruckRecommendationRequest(BaseModel):
    weight_kg: float = Field(..., gt=0)
    volume_m3: float = Field(..., gt=0)
    distance_km: float = Field(..., gt=0)
    cargo_type: Optional[str] = "GENERAL"
    priority: Optional[str] = "NORMAL"


class DeliveryPredictionRequest(BaseModel):
    weight_kg: float = Field(..., gt=0)
    distance_km: float = Field(..., gt=0)
    truck_type: str
    traffic_condition: Optional[str] = "MODERATE"
    weather_condition: Optional[str] = "CLEAR"


class ShipmentClusterRequest(BaseModel):
    shipments: List[dict]


class DelayPredictionRequest(BaseModel):
    distance_km: float
    weight_kg: float
    truck_type: str
    weather_condition: str
    traffic_condition: str
    time_of_day: str


class FuelEstimationRequest(BaseModel):
    distance_km: float
    weight_kg: float
    truck_type: str


class CargoOptimizationRequest(BaseModel):
    truck_capacity_kg: float
    truck_capacity_m3: float
    items: List[dict]


@app.get("/")
async def root():
    return {
        "service": "FreightZen ML Service",
        "version": "1.0.0",
        "status": "operational"
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy", "models_loaded": True}


@app.post("/predict-truck")
async def predict_truck(request: TruckRecommendationRequest):
    try:
        result = truck_recommender.recommend(
            weight_kg=request.weight_kg,
            volume_m3=request.volume_m3,
            distance_km=request.distance_km,
            cargo_type=request.cargo_type,
            priority=request.priority
        )
        logger.info(f"Truck recommendation: {result['recommended_truck']}")
        return result
    except Exception as e:
        logger.error(f"Truck recommendation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict-delivery-time")
async def predict_delivery_time(request: DeliveryPredictionRequest):
    try:
        result = delivery_predictor.predict(
            weight_kg=request.weight_kg,
            distance_km=request.distance_km,
            truck_type=request.truck_type,
            traffic_condition=request.traffic_condition,
            weather_condition=request.weather_condition
        )
        logger.info(f"Delivery time prediction: {result['predicted_hours']:.2f} hours")
        return result
    except Exception as e:
        logger.error(f"Delivery prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/cluster-shipments")
async def cluster_shipments(request: ShipmentClusterRequest):
    try:
        result = shipment_clusterer.cluster(request.shipments)
        logger.info(f"Clustered {len(request.shipments)} shipments into {result['num_clusters']} groups")
        return result
    except Exception as e:
        logger.error(f"Shipment clustering failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict-delay-risk")
async def predict_delay_risk(request: DelayPredictionRequest):
    try:
        result = delay_predictor.predict(
            distance_km=request.distance_km,
            weight_kg=request.weight_kg,
            truck_type=request.truck_type,
            weather_condition=request.weather_condition,
            traffic_condition=request.traffic_condition,
            time_of_day=request.time_of_day
        )
        logger.info(f"Delay risk: {result['risk_level']}")
        return result
    except Exception as e:
        logger.error(f"Delay prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/estimate-fuel")
async def estimate_fuel(request: FuelEstimationRequest):
    try:
        result = fuel_estimator.estimate(
            distance_km=request.distance_km,
            weight_kg=request.weight_kg,
            truck_type=request.truck_type
        )
        logger.info(f"Fuel estimate: {result['estimated_liters']:.2f} liters")
        return result
    except Exception as e:
        logger.error(f"Fuel estimation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/optimize-cargo")
async def optimize_cargo(request: CargoOptimizationRequest):
    try:
        result = cargo_optimizer.optimize(
            truck_capacity_kg=request.truck_capacity_kg,
            truck_capacity_m3=request.truck_capacity_m3,
            items=request.items
        )
        logger.info(f"Cargo optimization: {result['utilization_percent']:.1f}% utilization")
        return result
    except Exception as e:
        logger.error(f"Cargo optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)


class NeuralDeliveryRequest(BaseModel):
    weight_kg: float = Field(..., gt=0)
    distance_km: float = Field(..., gt=0)
    truck_type: str
    traffic_condition: Optional[str] = "MODERATE"
    weather_condition: Optional[str] = "CLEAR"
    departure_time: Optional[str] = None
    route_complexity: Optional[float] = 1.0


class RouteOptimizationRequest(BaseModel):
    start: dict
    destinations: List[dict]
    constraints: Optional[dict] = None


class MaintenanceRequest(BaseModel):
    truck_id: str
    mileage_km: float
    age_months: int
    last_service_km: float
    usage_intensity: Optional[str] = "MODERATE"
    operating_conditions: Optional[str] = "NORMAL"
    sensor_data: Optional[dict] = None


@app.post("/predict-delivery-neural")
async def predict_delivery_neural(request: NeuralDeliveryRequest):
    """Advanced neural network-based delivery prediction with attention mechanism."""
    try:
        result = neural_delivery_predictor.predict(
            weight_kg=request.weight_kg,
            distance_km=request.distance_km,
            truck_type=request.truck_type,
            traffic_condition=request.traffic_condition,
            weather_condition=request.weather_condition,
            departure_time=request.departure_time,
            route_complexity=request.route_complexity
        )
        logger.info(f"Neural delivery prediction: {result['predicted_hours']:.2f} hours")
        return result
    except Exception as e:
        logger.error(f"Neural delivery prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/optimize-route")
async def optimize_route(request: RouteOptimizationRequest):
    """Advanced route optimization using reinforcement learning and 2-opt."""
    try:
        result = route_optimizer.optimize_route(
            start=request.start,
            destinations=request.destinations,
            constraints=request.constraints
        )
        logger.info(f"Route optimized: {result['total_distance_km']:.2f} km, {result['route_efficiency_score']:.1f}% efficiency")
        return result
    except Exception as e:
        logger.error(f"Route optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/predict-maintenance")
async def predict_maintenance(request: MaintenanceRequest):
    """Predictive maintenance analysis with failure prediction."""
    try:
        result = predictive_maintenance.predict_maintenance({
            'truck_id': request.truck_id,
            'mileage_km': request.mileage_km,
            'age_months': request.age_months,
            'last_service_km': request.last_service_km,
            'usage_intensity': request.usage_intensity,
            'operating_conditions': request.operating_conditions,
            'sensor_data': request.sensor_data or {}
        })
        logger.info(f"Maintenance prediction for {request.truck_id}: {result['health_status']} ({result['overall_health_score']:.1f}%)")
        return result
    except Exception as e:
        logger.error(f"Maintenance prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================================
# V2 ENDPOINTS - Advanced ML Models with Pre-trained Weights
# ============================================================================

@app.post("/v2/predict-truck")
async def predict_truck_v2(request: TruckRecommendationRequest):
    """
    Advanced truck recommendation using XGBoost + LightGBM ensemble.
    Accuracy: 82.97% | Pre-trained model loads instantly.
    """
    try:
        result = truck_recommender_v2.recommend(
            weight_kg=request.weight_kg,
            volume_m3=request.volume_m3,
            distance_km=request.distance_km,
            cargo_type=request.cargo_type,
            priority=request.priority
        )
        logger.info(f"V2 Truck recommendation: {result['recommended_truck']} (confidence: {result['confidence']:.3f})")
        return result
    except Exception as e:
        logger.error(f"V2 Truck recommendation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v2/predict-delivery-time")
async def predict_delivery_time_v2(request: DeliveryPredictionRequest):
    """
    Advanced delivery time prediction using XGBoost + CatBoost ensemble.
    R² Score: 0.9410 | MAE: 1.82 hours | Pre-trained model loads instantly.
    """
    try:
        result = delivery_predictor_v2.predict(
            weight_kg=request.weight_kg,
            distance_km=request.distance_km,
            truck_type=request.truck_type,
            traffic_condition=request.traffic_condition,
            weather_condition=request.weather_condition
        )
        logger.info(f"V2 Delivery time prediction: {result['predicted_hours']:.2f} hours (R²={result['model_r2_score']:.4f})")
        return result
    except Exception as e:
        logger.error(f"V2 Delivery prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v2/cluster-shipments")
async def cluster_shipments_v2(request: ShipmentClusterRequest):
    """
    Advanced shipment clustering using K-Means++ + DBSCAN.
    Silhouette Score: 0.2431 | Pre-trained model loads instantly.
    """
    try:
        result = shipment_clusterer_v2.cluster(request.shipments)
        logger.info(f"V2 Clustered {result['total_shipments']} shipments into {result['n_clusters']} groups (silhouette: {result['silhouette_score']:.4f})")
        return result
    except Exception as e:
        logger.error(f"V2 Shipment clustering failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v2/estimate-fuel")
async def estimate_fuel_v2(request: FuelEstimationRequest):
    """
    Advanced fuel estimation using XGBoost + Random Forest ensemble.
    R² Score: 0.9729 | MAE: 13.68 liters | Pre-trained model loads instantly.
    """
    try:
        result = fuel_estimator_v2.estimate(
            distance_km=request.distance_km,
            weight_kg=request.weight_kg,
            truck_type=request.truck_type
        )
        logger.info(f"V2 Fuel estimate: {result['estimated_liters']:.2f} liters (${result['estimated_cost']:.2f})")
        return result
    except Exception as e:
        logger.error(f"V2 Fuel estimation failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.get("/v2/models/info")
async def get_v2_models_info():
    """
    Get information about all V2 models including performance metrics.
    """
    return {
        "version": "2.0.0",
        "models": {
            "truck_recommender_v2": {
                "algorithm": "XGBoost + LightGBM Ensemble",
                "accuracy": truck_recommender_v2.accuracy,
                "cv_score": truck_recommender_v2.cv_score,
                "endpoint": "/v2/predict-truck",
                "status": "loaded",
                "pre_trained": True
            },
            "delivery_predictor_v2": {
                "algorithm": "XGBoost + CatBoost Ensemble",
                "r2_score": delivery_predictor_v2.r2_score,
                "mae_hours": delivery_predictor_v2.mae,
                "rmse_hours": delivery_predictor_v2.rmse,
                "endpoint": "/v2/predict-delivery-time",
                "status": "loaded",
                "pre_trained": True
            },
            "shipment_clusterer_v2": {
                "algorithm": "K-Means++ + DBSCAN",
                "silhouette_score": shipment_clusterer_v2.silhouette_score,
                "n_clusters": 5,
                "endpoint": "/v2/cluster-shipments",
                "status": "loaded",
                "pre_trained": True
            },
            "fuel_estimator_v2": {
                "algorithm": "XGBoost + Random Forest Ensemble",
                "r2_score": fuel_estimator_v2.r2_score,
                "mae_liters": fuel_estimator_v2.mae,
                "endpoint": "/v2/estimate-fuel",
                "status": "loaded",
                "pre_trained": True
            },
            "delay_predictor_v2": {
                "algorithm": "XGBoost + CatBoost Ensemble",
                "accuracy": delay_predictor_v2.accuracy,
                "cv_score": delay_predictor_v2.cv_score,
                "roc_auc": delay_predictor_v2.roc_auc,
                "endpoint": "/v2/predict-delay-risk",
                "status": "loaded",
                "pre_trained": True
            },
            "route_optimizer_v2": {
                "algorithm": "Genetic Algorithm + 2-opt",
                "avg_improvement": route_optimizer_v2.avg_improvement,
                "best_efficiency": route_optimizer_v2.best_efficiency,
                "endpoint": "/v2/optimize-route",
                "status": "loaded",
                "pre_trained": True
            }
        },
        "features": [
            "Pre-trained models load instantly (< 6 seconds)",
            "No training required for collaborators",
            "High accuracy (81-97% across models)",
            "Real-time inference (< 10ms per prediction)",
            "Ensemble methods for robust predictions"
        ]
    }


@app.post("/v2/predict-delay-risk")
async def predict_delay_risk_v2(request: DelayPredictionRequest):
    """
    Advanced delay risk prediction using XGBoost + CatBoost ensemble.
    Accuracy: 80.80% | ROC AUC: 0.9434 | Pre-trained model loads instantly.
    """
    try:
        result = delay_predictor_v2.predict(
            distance_km=request.distance_km,
            weight_kg=request.weight_kg,
            truck_type=request.truck_type,
            weather_condition=request.weather_condition,
            traffic_condition=request.traffic_condition,
            time_of_day=request.time_of_day
        )
        logger.info(f"V2 Delay risk: {result['risk_level']} (confidence: {result['confidence']:.3f})")
        return result
    except Exception as e:
        logger.error(f"V2 Delay prediction failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))


@app.post("/v2/optimize-route")
async def optimize_route_v2(request: RouteOptimizationRequest):
    """
    Advanced route optimization using Genetic Algorithm + 2-opt.
    Avg Improvement: 42.2% | Best Efficiency: 98.5% | Pre-trained model loads instantly.
    """
    try:
        result = route_optimizer_v2.optimize_route(
            start=request.start,
            destinations=request.destinations,
            constraints=request.constraints
        )
        logger.info(f"V2 Route optimized: {result['total_distance_km']:.2f} km ({result['improvement_percent']:.1f}% improvement)")
        return result
    except Exception as e:
        logger.error(f"V2 Route optimization failed: {str(e)}")
        raise HTTPException(status_code=500, detail=str(e))
