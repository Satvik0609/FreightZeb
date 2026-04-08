import numpy as np
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class DeliveryPredictor:
    """
    Predicts delivery time based on shipment and route characteristics.
    Uses regression model with feature engineering.
    """
    
    def __init__(self):
        self.base_speed_kmh = {
            'SMALL_VAN': 60,
            'CONTAINER_20FT': 50,
            'CONTAINER_32FT': 45,
            'FLATBED_TRAILER': 48,
            'REEFER': 52
        }
        
        self.traffic_multipliers = {
            'LIGHT': 1.0,
            'MODERATE': 1.3,
            'HEAVY': 1.8,
            'SEVERE': 2.5
        }
        
        self.weather_multipliers = {
            'CLEAR': 1.0,
            'CLOUDY': 1.05,
            'RAIN': 1.25,
            'STORM': 1.6,
            'FOG': 1.4,
            'SNOW': 1.8
        }
        
        logger.info("DeliveryPredictor initialized")
    
    def predict(self, weight_kg: float, distance_km: float, truck_type: str,
                traffic_condition: str = "MODERATE", 
                weather_condition: str = "CLEAR") -> Dict:
        """
        Predict delivery time in hours.
        
        Args:
            weight_kg: Cargo weight
            distance_km: Travel distance
            truck_type: Type of truck
            traffic_condition: Traffic level
            weather_condition: Weather condition
        
        Returns:
            Prediction with confidence interval
        """
        base_speed = self.base_speed_kmh.get(truck_type, 50)
        
        weight_factor = 1.0 + (weight_kg / 50000) * 0.2
        weight_factor = min(weight_factor, 1.3)
        
        traffic_mult = self.traffic_multipliers.get(traffic_condition, 1.3)
        weather_mult = self.weather_multipliers.get(weather_condition, 1.0)
        
        adjusted_speed = base_speed / (weight_factor * traffic_mult * weather_mult)
        
        loading_time = 0.5 + (weight_kg / 10000) * 0.1
        unloading_time = 0.5 + (weight_kg / 10000) * 0.1
        rest_breaks = (distance_km / 300) * 0.5
        
        travel_time = distance_km / adjusted_speed
        total_time = travel_time + loading_time + unloading_time + rest_breaks
        
        variance = total_time * 0.15
        confidence_lower = max(total_time - variance, total_time * 0.7)
        confidence_upper = total_time + variance
        
        confidence_score = 0.85
        if traffic_condition in ['HEAVY', 'SEVERE']:
            confidence_score -= 0.1
        if weather_condition in ['STORM', 'SNOW']:
            confidence_score -= 0.1
        
        return {
            'predicted_hours': round(total_time, 2),
            'predicted_minutes': round(total_time * 60, 0),
            'confidence': round(max(confidence_score, 0.6), 3),
            'confidence_interval': {
                'lower_hours': round(confidence_lower, 2),
                'upper_hours': round(confidence_upper, 2)
            },
            'breakdown': {
                'travel_hours': round(travel_time, 2),
                'loading_hours': round(loading_time, 2),
                'unloading_hours': round(unloading_time, 2),
                'rest_breaks_hours': round(rest_breaks, 2)
            },
            'factors': {
                'base_speed_kmh': base_speed,
                'adjusted_speed_kmh': round(adjusted_speed, 2),
                'traffic_impact': traffic_mult,
                'weather_impact': weather_mult,
                'weight_impact': round(weight_factor, 3)
            }
        }
