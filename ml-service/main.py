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
