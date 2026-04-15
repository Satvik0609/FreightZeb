import numpy as np
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class DelayPredictor:
    def __init__(self):
        self.weather_weights = {'CLEAR': 0.0, 'CLOUDY': 0.1, 'RAIN': 0.3, 'STORM': 0.6, 'FOG': 0.4, 'SNOW': 0.5}
        self.traffic_weights = {'LIGHT': 0.0, 'MODERATE': 0.2, 'HEAVY': 0.5, 'SEVERE': 0.8}
        self.time_weights = {'MORNING': 0.3, 'AFTERNOON': 0.2, 'EVENING': 0.4, 'NIGHT': 0.1}
        logger.info('DelayPredictor initialized')
    
    def predict(self, distance_km: float, weight_kg: float, truck_type: str, weather_condition: str, traffic_condition: str, time_of_day: str) -> Dict:
        distance_risk = min(distance_km / 1000, 0.5)
        weight_risk = min(weight_kg / 50000, 0.3)
        weather_risk = self.weather_weights.get(weather_condition.upper(), 0.2)
        traffic_risk = self.traffic_weights.get(traffic_condition.upper(), 0.2)
        time_risk = self.time_weights.get(time_of_day.upper(), 0.2)
        total_risk = distance_risk * 0.2 + weight_risk * 0.1 + weather_risk * 0.3 + traffic_risk * 0.3 + time_risk * 0.1
        
        if total_risk < 0.25:
            risk_level = 'LOW'
            delay_probability = total_risk * 100
        elif total_risk < 0.5:
            risk_level = 'MODERATE'
            delay_probability = 25 + (total_risk - 0.25) * 100
        elif total_risk < 0.75:
            risk_level = 'HIGH'
            delay_probability = 50 + (total_risk - 0.5) * 100
        else:
            risk_level = 'CRITICAL'
            delay_probability = 75 + (total_risk - 0.75) * 100
        
        estimated_delay_hours = (distance_km / 60) * (1 + total_risk) * 0.2
        
        return {
            'risk_level': risk_level,
            'delay_probability': round(min(delay_probability, 95), 2),
            'risk_score': round(total_risk, 3),
            'estimated_delay_hours': round(estimated_delay_hours, 2)
        }
