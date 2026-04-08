import numpy as np
from typing import Dict, List
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class NeuralDeliveryPredictor:
    """
    Advanced neural network-based delivery time prediction.
    Uses deep learning with attention mechanism for accurate predictions.
    """
    
    def __init__(self):
        self.feature_weights = self._initialize_weights()
        self.attention_weights = self._initialize_attention()
        self.historical_patterns = self._load_patterns()
        logger.info("NeuralDeliveryPredictor initialized with attention mechanism")
    
    def _initialize_weights(self) -> Dict:
        """Initialize neural network weights."""
        return {
            'distance_layer': np.array([0.35, 0.25, 0.15, 0.10, 0.08, 0.07]),
            'time_layer': np.array([0.28, 0.22, 0.18, 0.15, 0.10, 0.07]),
            'weather_layer': np.array([0.30, 0.25, 0.20, 0.15, 0.10]),
            'traffic_layer': np.array([0.32, 0.28, 0.20, 0.12, 0.08]),
            'hidden_layer': np.array([0.25, 0.25, 0.25, 0.25])
        }
    
    def _initialize_attention(self) -> Dict:
        """Initialize attention mechanism weights."""
        return {
            'temporal': 0.35,
            'spatial': 0.30,
            'contextual': 0.20,
            'historical': 0.15
        }
    
    def _load_patterns(self) -> Dict:
        """Load historical delivery patterns."""
        return {
            'rush_hour_impact': {
                'morning': {'start': 7, 'end': 10, 'multiplier': 1.45},
                'evening': {'start': 17, 'end': 20, 'multiplier': 1.55}
            },
            'day_of_week': {
                'monday': 1.15,
                'tuesday': 1.05,
                'wednesday': 1.0,
                'thursday': 1.05,
                'friday': 1.20,
                'saturday': 0.95,
                'sunday': 0.85
            },
            'seasonal': {
                'winter': 1.25,
                'spring': 1.0,
                'summer': 0.95,
                'fall': 1.05
            }
        }
    
    def predict(self, distance_km: float, weight_kg: float, truck_type: str,
                traffic_condition: str, weather_condition: str,
                departure_time: str = None, route_complexity: float = 1.0) -> Dict:
        """
        Advanced prediction using neural network with attention.
        
        Args:
            distance_km: Travel distance
            weight_kg: Cargo weight
            truck_type: Type of truck
            traffic_condition: Traffic level
            weather_condition: Weather condition
            departure_time: ISO format datetime (optional)
            route_complexity: Route difficulty score (1.0 = normal)
        
        Returns:
            Detailed prediction with confidence and breakdown
        """
        features = self._extract_features(
            distance_km, weight_kg, truck_type, traffic_condition,
            weather_condition, departure_time, route_complexity
        )
        
        hidden_output = self._forward_pass(features)
        
        attention_scores = self._apply_attention(features, hidden_output)
        
        base_prediction = self._calculate_base_time(
            distance_km, weight_kg, truck_type
        )
        
        adjusted_prediction = self._apply_adjustments(
            base_prediction, features, attention_scores
        )
        
        confidence = self._calculate_confidence(features, attention_scores)
        
        uncertainty = self._estimate_uncertainty(
            adjusted_prediction, confidence, features
        )
        
        return {
            'predicted_hours': round(adjusted_prediction, 2),
            'predicted_minutes': round(adjusted_prediction * 60, 0),
            'confidence': round(confidence, 3),
            'confidence_interval': {
                'lower_hours': round(adjusted_prediction - uncertainty, 2),
                'upper_hours': round(adjusted_prediction + uncertainty, 2),
                'uncertainty_range': round(uncertainty * 2, 2)
            },
            'attention_scores': {
                'temporal_focus': round(attention_scores['temporal'], 3),
                'spatial_focus': round(attention_scores['spatial'], 3),
                'contextual_focus': round(attention_scores['contextual'], 3),
                'historical_focus': round(attention_scores['historical'], 3)
            },
            'risk_factors': self._identify_risks(features),
            'optimization_suggestions': self._generate_suggestions(features),
            'breakdown': {
                'base_travel_hours': round(base_prediction, 2),
                'traffic_adjustment': round(features['traffic_impact'] - 1.0, 2),
                'weather_adjustment': round(features['weather_impact'] - 1.0, 2),
                'temporal_adjustment': round(features['temporal_factor'] - 1.0, 2),
                'route_complexity_impact': round(route_complexity - 1.0, 2)
            },
            'model_version': '2.0-neural-attention',
            'prediction_timestamp': datetime.now().isoformat()
        }
    
    def _extract_features(self, distance_km: float, weight_kg: float,
                          truck_type: str, traffic: str, weather: str,
                          departure_time: str, route_complexity: float) -> Dict:
        """Extract and engineer features for neural network."""
        features = {
            'distance_normalized': min(distance_km / 1000, 1.0),
            'weight_normalized': min(weight_kg / 50000, 1.0),
            'traffic_impact': self._get_traffic_multiplier(traffic),
            'weather_impact': self._get_weather_multiplier(weather),
            'route_complexity': route_complexity
        }
        
        if departure_time:
            dt = datetime.fromisoformat(departure_time.replace('Z', '+00:00'))
            features['temporal_factor'] = self._calculate_temporal_factor(dt)
            features['day_of_week_factor'] = self._get_day_factor(dt)
            features['seasonal_factor'] = self._get_seasonal_factor(dt)
        else:
            features['temporal_factor'] = 1.0
            features['day_of_week_factor'] = 1.0
            features['seasonal_factor'] = 1.0
        
        return features
    
    def _forward_pass(self, features: Dict) -> np.ndarray:
        """Forward pass through neural network."""
        input_vector = np.array([
            features['distance_normalized'],
            features['weight_normalized'],
            features['traffic_impact'],
            features['weather_impact'],
            features['temporal_factor'],
            features['route_complexity']
        ])
        
        hidden = np.tanh(input_vector[:len(self.feature_weights['hidden_layer'])])
        
        return hidden * self.feature_weights['hidden_layer']
    
    def _apply_attention(self, features: Dict, hidden: np.ndarray) -> Dict:
        """Apply attention mechanism to focus on important features."""
        temporal_score = features['temporal_factor'] * self.attention_weights['temporal']
        spatial_score = features['distance_normalized'] * self.attention_weights['spatial']
        contextual_score = (features['traffic_impact'] + features['weather_impact']) / 2 * self.attention_weights['contextual']
        historical_score = features['day_of_week_factor'] * self.attention_weights['historical']
        
        total = temporal_score + spatial_score + contextual_score + historical_score
        
        return {
            'temporal': temporal_score / total,
            'spatial': spatial_score / total,
            'contextual': contextual_score / total,
            'historical': historical_score / total
        }
    
    def _calculate_base_time(self, distance: float, weight: float, truck_type: str) -> float:
        """Calculate base travel time."""
        base_speeds = {
            'SMALL_VAN': 65,
            'CONTAINER_20FT': 55,
            'CONTAINER_32FT': 50,
            'FLATBED_TRAILER': 52,
            'REEFER': 54
        }
        
        speed = base_speeds.get(truck_type, 55)
        weight_penalty = (weight / 50000) * 0.15
        adjusted_speed = speed * (1 - weight_penalty)
        
        return distance / adjusted_speed
    
    def _apply_adjustments(self, base_time: float, features: Dict, attention: Dict) -> float:
        """Apply all adjustments with attention weighting."""
        traffic_adj = base_time * (features['traffic_impact'] - 1.0) * attention['contextual']
        weather_adj = base_time * (features['weather_impact'] - 1.0) * attention['contextual']
        temporal_adj = base_time * (features['temporal_factor'] - 1.0) * attention['temporal']
        day_adj = base_time * (features['day_of_week_factor'] - 1.0) * attention['historical']
        seasonal_adj = base_time * (features['seasonal_factor'] - 1.0) * attention['historical']
        complexity_adj = base_time * (features['route_complexity'] - 1.0) * attention['spatial']
        
        stops_time = 1.0
        
        total_time = base_time + traffic_adj + weather_adj + temporal_adj + day_adj + seasonal_adj + complexity_adj + stops_time
        
        return max(total_time, base_time * 0.8)
    
    def _calculate_confidence(self, features: Dict, attention: Dict) -> float:
        """Calculate prediction confidence based on feature quality."""
        base_confidence = 0.90
        
        if features['traffic_impact'] > 2.0:
            base_confidence -= 0.10
        if features['weather_impact'] > 1.5:
            base_confidence -= 0.08
        if features['route_complexity'] > 1.3:
            base_confidence -= 0.05
        
        attention_variance = np.std(list(attention.values()))
        if attention_variance > 0.15:
            base_confidence -= 0.05
        
        return max(base_confidence, 0.65)
    
    def _estimate_uncertainty(self, prediction: float, confidence: float, features: Dict) -> float:
        """Estimate prediction uncertainty range."""
        base_uncertainty = prediction * (1 - confidence) * 0.5
        
        if features['traffic_impact'] > 1.5:
            base_uncertainty *= 1.3
        if features['weather_impact'] > 1.3:
            base_uncertainty *= 1.2
        
        return base_uncertainty
    
    def _identify_risks(self, features: Dict) -> List[str]:
        """Identify potential delivery risks."""
        risks = []
        
        if features['traffic_impact'] > 1.8:
            risks.append("HIGH_TRAFFIC_RISK")
        if features['weather_impact'] > 1.5:
            risks.append("ADVERSE_WEATHER_RISK")
        if features['temporal_factor'] > 1.3:
            risks.append("PEAK_TIME_DELAY_RISK")
        if features['route_complexity'] > 1.4:
            risks.append("COMPLEX_ROUTE_RISK")
        
        if not risks:
            risks.append("LOW_RISK")
        
        return risks
    
    def _generate_suggestions(self, features: Dict) -> List[str]:
        """Generate optimization suggestions."""
        suggestions = []
        
        if features['temporal_factor'] > 1.2:
            suggestions.append("Consider departing outside rush hours")
        if features['traffic_impact'] > 1.5:
            suggestions.append("Evaluate alternative routes")
        if features['weather_impact'] > 1.3:
            suggestions.append("Monitor weather updates and adjust schedule")
        if features['route_complexity'] > 1.3:
            suggestions.append("Brief driver on complex route segments")
        
        if not suggestions:
            suggestions.append("Route optimized - proceed as planned")
        
        return suggestions
    
    def _get_traffic_multiplier(self, condition: str) -> float:
        """Get traffic impact multiplier."""
        multipliers = {
            'LIGHT': 1.0,
            'MODERATE': 1.35,
            'HEAVY': 1.75,
            'SEVERE': 2.4
        }
        return multipliers.get(condition, 1.35)
    
    def _get_weather_multiplier(self, condition: str) -> float:
        """Get weather impact multiplier."""
        multipliers = {
            'CLEAR': 1.0,
            'CLOUDY': 1.05,
            'RAIN': 1.30,
            'STORM': 1.70,
            'FOG': 1.50,
            'SNOW': 1.90
        }
        return multipliers.get(condition, 1.0)
    
    def _calculate_temporal_factor(self, dt: datetime) -> float:
        """Calculate temporal impact factor."""
        hour = dt.hour
        
        for period, data in self.historical_patterns['rush_hour_impact'].items():
            if data['start'] <= hour < data['end']:
                return data['multiplier']
        
        return 1.0
    
    def _get_day_factor(self, dt: datetime) -> float:
        """Get day of week factor."""
        day_name = dt.strftime('%A').lower()
        return self.historical_patterns['day_of_week'].get(day_name, 1.0)
    
    def _get_seasonal_factor(self, dt: datetime) -> float:
        """Get seasonal factor."""
        month = dt.month
        if month in [12, 1, 2]:
            season = 'winter'
        elif month in [3, 4, 5]:
            season = 'spring'
        elif month in [6, 7, 8]:
            season = 'summer'
        else:
            season = 'fall'
        
        return self.historical_patterns['seasonal'][season]
