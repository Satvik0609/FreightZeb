import numpy as np
from typing import Dict
import logging

logger = logging.getLogger(__name__)


class DelayPredictor:
    """
    Predicts likelihood and severity of delivery delays.
    Uses classification and risk scoring.
    """
    
    def __init__(self):
        self.risk_weights = {
            'distance': 0.25,
            'weather': 0.30,
            'traffic': 0.25,
            'time_of_day': 0.20
        }
        logger.info("DelayPredictor initialized")
    
    def predict(self, distance_km: float, weight_kg: float, truck_type: str,
                weather_condition: str, traffic_condition: str, 
                time_of_day: str) -> Dict:
        """
        Predict delay risk for a shipment.
        
        Args:
            distance_km: Travel distance
            weight_kg: Cargo weight
            truck_type: Type of truck
            weather_condition: Weather forecast
            traffic_condition: Expected traffic
            time_of_day: Departure time category (MORNING, AFTERNOON, EVENING, NIGHT)
        
        Returns:
            Risk assessment with probability and recommendations
        """
        distance_risk = self._calculate_distance_risk(distance_km)
        weather_risk = self._calculate_weather_risk(weather_condition)
        traffic_risk = self._calculate_traffic_risk(traffic_condition)
        time_risk = self._calculate_time_risk(time_of_day)
        
        total_risk = (
            distance_risk * self.risk_weights['distance'] +
            weather_risk * self.risk_weights['weather'] +
            traffic_risk * self.risk_weights['traffic'] +
            time_risk * self.risk_weights['time_of_day']
        )
        
        risk_level = self._classify_risk(total_risk)
        delay_probability = total_risk / 100
        
        expected_delay_minutes = 0
        if total_risk > 30:
            expected_delay_minutes = (total_risk - 30) * 2
        
        recommendations = self._generate_recommendations(
            risk_level, weather_condition, traffic_condition, time_of_day
        )
        
        return {
            'risk_score': round(total_risk, 2),
            'risk_level': risk_level,
            'delay_probability': round(delay_probability, 3),
            'expected_delay_minutes': round(expected_delay_minutes, 0),
            'risk_factors': {
                'distance_risk': round(distance_risk, 2),
                'weather_risk': round(weather_risk, 2),
                'traffic_risk': round(traffic_risk, 2),
                'time_of_day_risk': round(time_risk, 2)
            },
            'recommendations': recommendations,
            'confidence': 0.82
        }
    
    def _calculate_distance_risk(self, distance_km: float) -> float:
        """Calculate risk based on distance."""
        if distance_km < 100:
            return 10
        elif distance_km < 300:
            return 25
        elif distance_km < 600:
            return 45
        elif distance_km < 1000:
            return 65
        else:
            return 85
    
    def _calculate_weather_risk(self, condition: str) -> float:
        """Calculate risk based on weather."""
        weather_scores = {
            'CLEAR': 5,
            'CLOUDY': 15,
            'RAIN': 50,
            'STORM': 85,
            'FOG': 60,
            'SNOW': 90
        }
        return weather_scores.get(condition, 30)
    
    def _calculate_traffic_risk(self, condition: str) -> float:
        """Calculate risk based on traffic."""
        traffic_scores = {
            'LIGHT': 10,
            'MODERATE': 35,
            'HEAVY': 65,
            'SEVERE': 90
        }
        return traffic_scores.get(condition, 35)
    
    def _calculate_time_risk(self, time_of_day: str) -> float:
        """Calculate risk based on departure time."""
        time_scores = {
            'MORNING': 45,
            'AFTERNOON': 35,
            'EVENING': 50,
            'NIGHT': 20
        }
        return time_scores.get(time_of_day, 35)
    
    def _classify_risk(self, risk_score: float) -> str:
        """Classify overall risk level."""
        if risk_score < 25:
            return 'LOW'
        elif risk_score < 50:
            return 'MEDIUM'
        elif risk_score < 75:
            return 'HIGH'
        else:
            return 'CRITICAL'
    
    def _generate_recommendations(self, risk_level: str, weather: str, 
                                   traffic: str, time: str) -> list:
        """Generate actionable recommendations."""
        recommendations = []
        
        if risk_level in ['HIGH', 'CRITICAL']:
            recommendations.append("Consider delaying shipment to reduce risk")
        
        if weather in ['STORM', 'SNOW', 'FOG']:
            recommendations.append(f"Severe weather ({weather}) - ensure driver safety protocols")
        
        if traffic in ['HEAVY', 'SEVERE']:
            recommendations.append("Plan alternative routes to avoid traffic congestion")
        
        if time == 'MORNING':
            recommendations.append("Morning rush hour - expect delays in urban areas")
        elif time == 'EVENING':
            recommendations.append("Evening rush hour - consider earlier departure")
        
        if risk_level == 'LOW':
            recommendations.append("Conditions favorable for on-time delivery")
        
        return recommendations
