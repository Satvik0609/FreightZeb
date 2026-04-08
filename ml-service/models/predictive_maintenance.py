import numpy as np
from typing import Dict, List
from datetime import datetime, timedelta
import logging

logger = logging.getLogger(__name__)


class PredictiveMaintenanceModel:
    """
    Advanced predictive maintenance using anomaly detection and failure prediction.
    Monitors truck health and predicts maintenance needs.
    """
    
    def __init__(self):
        self.failure_thresholds = self._initialize_thresholds()
        self.component_lifespans = self._initialize_lifespans()
        self.anomaly_detector = self._initialize_anomaly_detector()
        logger.info("PredictiveMaintenanceModel initialized")
    
    def _initialize_thresholds(self) -> Dict:
        """Initialize component health thresholds."""
        return {
            'engine': {'critical': 20, 'warning': 40, 'good': 70},
            'transmission': {'critical': 25, 'warning': 45, 'good': 75},
            'brakes': {'critical': 15, 'warning': 35, 'good': 65},
            'tires': {'critical': 20, 'warning': 40, 'good': 70},
            'suspension': {'critical': 30, 'warning': 50, 'good': 80},
            'electrical': {'critical': 25, 'warning': 45, 'good': 75}
        }
    
    def _initialize_lifespans(self) -> Dict:
        """Initialize expected component lifespans (in km)."""
        return {
            'engine': 500000,
            'transmission': 400000,
            'brakes': 80000,
            'tires': 60000,
            'suspension': 200000,
            'electrical': 300000
        }
    
    def _initialize_anomaly_detector(self) -> Dict:
        """Initialize anomaly detection parameters."""
        return {
            'sensitivity': 0.85,
            'window_size': 10,
            'threshold_multiplier': 2.5
        }
    
    def predict_maintenance(self, truck_data: Dict) -> Dict:
        """
        Predict maintenance needs for a truck.
        
        Args:
            truck_data: {
                truck_id, mileage_km, age_months, last_service_km,
                usage_intensity, operating_conditions,
                sensor_data (optional)
            }
        
        Returns:
            Comprehensive maintenance prediction
        """
        component_health = self._assess_component_health(truck_data)
        
        failure_predictions = self._predict_failures(truck_data, component_health)
        
        maintenance_schedule = self._generate_schedule(
            truck_data, component_health, failure_predictions
        )
        
        cost_estimate = self._estimate_costs(maintenance_schedule)
        
        anomalies = self._detect_anomalies(truck_data)
        
        recommendations = self._generate_recommendations(
            component_health, failure_predictions, anomalies
        )
        
        return {
            'truck_id': truck_data.get('truck_id', 'unknown'),
            'overall_health_score': round(self._calculate_overall_health(component_health), 2),
            'health_status': self._classify_health(component_health),
            'component_health': component_health,
            'failure_predictions': failure_predictions,
            'maintenance_schedule': maintenance_schedule,
            'cost_estimate': cost_estimate,
            'detected_anomalies': anomalies,
            'recommendations': recommendations,
            'next_service_km': self._calculate_next_service(truck_data, component_health),
            'urgency_level': self._determine_urgency(component_health, failure_predictions),
            'prediction_confidence': 0.87,
            'model_version': '1.0-predictive'
        }
    
    def _assess_component_health(self, truck_data: Dict) -> Dict:
        """Assess health of each truck component."""
        mileage = truck_data.get('mileage_km', 0)
        age_months = truck_data.get('age_months', 0)
        last_service = truck_data.get('last_service_km', 0)
        usage_intensity = truck_data.get('usage_intensity', 'MODERATE')
        conditions = truck_data.get('operating_conditions', 'NORMAL')
        
        intensity_multiplier = {
            'LIGHT': 0.8,
            'MODERATE': 1.0,
            'HEAVY': 1.3,
            'EXTREME': 1.6
        }.get(usage_intensity, 1.0)
        
        conditions_multiplier = {
            'EXCELLENT': 0.9,
            'NORMAL': 1.0,
            'HARSH': 1.2,
            'SEVERE': 1.4
        }.get(conditions, 1.0)
        
        health = {}
        
        for component, lifespan in self.component_lifespans.items():
            effective_mileage = mileage * intensity_multiplier * conditions_multiplier
            
            wear_percentage = (effective_mileage / lifespan) * 100
            
            service_factor = min((mileage - last_service) / 10000, 1.0)
            wear_percentage += service_factor * 10
            
            age_factor = (age_months / 120) * 5
            wear_percentage += age_factor
            
            health_score = max(100 - wear_percentage, 0)
            
            health[component] = {
                'health_score': round(health_score, 2),
                'wear_percentage': round(min(wear_percentage, 100), 2),
                'status': self._get_status(component, health_score),
                'estimated_remaining_km': round(max(lifespan - effective_mileage, 0), 0)
            }
        
        return health
    
    def _predict_failures(self, truck_data: Dict, health: Dict) -> List[Dict]:
        """Predict potential component failures."""
        predictions = []
        mileage = truck_data.get('mileage_km', 0)
        
        for component, data in health.items():
            if data['health_score'] < 50:
                failure_probability = (50 - data['health_score']) / 50
                
                remaining_km = data['estimated_remaining_km']
                days_to_failure = (remaining_km / 200) if remaining_km > 0 else 0
                
                predictions.append({
                    'component': component,
                    'failure_probability': round(failure_probability, 3),
                    'estimated_failure_km': round(mileage + remaining_km, 0),
                    'estimated_days_to_failure': round(days_to_failure, 0),
                    'severity': self._assess_failure_severity(component, failure_probability),
                    'preventive_action': self._get_preventive_action(component)
                })
        
        return sorted(predictions, key=lambda x: x['failure_probability'], reverse=True)
    
    def _generate_schedule(self, truck_data: Dict, health: Dict,
                           failures: List[Dict]) -> List[Dict]:
        """Generate maintenance schedule."""
        schedule = []
        mileage = truck_data.get('mileage_km', 0)
        
        for component, data in health.items():
            if data['status'] in ['CRITICAL', 'WARNING']:
                urgency = 'IMMEDIATE' if data['status'] == 'CRITICAL' else 'SOON'
                schedule.append({
                    'component': component,
                    'action': 'REPLACE' if data['health_score'] < 30 else 'SERVICE',
                    'urgency': urgency,
                    'recommended_km': mileage + (500 if urgency == 'IMMEDIATE' else 2000),
                    'estimated_downtime_hours': self._estimate_downtime(component),
                    'priority': 1 if urgency == 'IMMEDIATE' else 2
                })
        
        routine_service_due = (mileage - truck_data.get('last_service_km', 0)) > 10000
        if routine_service_due:
            schedule.append({
                'component': 'GENERAL',
                'action': 'ROUTINE_SERVICE',
                'urgency': 'SCHEDULED',
                'recommended_km': mileage + 1000,
                'estimated_downtime_hours': 4,
                'priority': 3
            })
        
        return sorted(schedule, key=lambda x: x['priority'])
    
    def _estimate_costs(self, schedule: List[Dict]) -> Dict:
        """Estimate maintenance costs."""
        component_costs = {
            'engine': 8000,
            'transmission': 6000,
            'brakes': 1200,
            'tires': 2000,
            'suspension': 1500,
            'electrical': 800,
            'GENERAL': 300
        }
        
        total_parts = 0
        total_labor = 0
        
        for item in schedule:
            component = item['component']
            action = item['action']
            
            if action == 'REPLACE':
                parts_cost = component_costs.get(component, 1000)
                labor_cost = parts_cost * 0.3
            elif action == 'SERVICE':
                parts_cost = component_costs.get(component, 1000) * 0.2
                labor_cost = parts_cost * 0.5
            else:
                parts_cost = component_costs.get(component, 300)
                labor_cost = 200
            
            total_parts += parts_cost
            total_labor += labor_cost
        
        return {
            'total_estimated_cost': round(total_parts + total_labor, 2),
            'parts_cost': round(total_parts, 2),
            'labor_cost': round(total_labor, 2),
            'currency': 'USD'
        }
    
    def _detect_anomalies(self, truck_data: Dict) -> List[Dict]:
        """Detect anomalies in truck operation."""
        anomalies = []
        
        sensor_data = truck_data.get('sensor_data', {})
        
        if sensor_data.get('engine_temp', 90) > 105:
            anomalies.append({
                'type': 'HIGH_ENGINE_TEMPERATURE',
                'severity': 'HIGH',
                'value': sensor_data['engine_temp'],
                'threshold': 105,
                'action': 'Check cooling system immediately'
            })
        
        if sensor_data.get('oil_pressure', 50) < 20:
            anomalies.append({
                'type': 'LOW_OIL_PRESSURE',
                'severity': 'CRITICAL',
                'value': sensor_data['oil_pressure'],
                'threshold': 20,
                'action': 'Stop vehicle and check oil level'
            })
        
        if sensor_data.get('vibration_level', 1.0) > 3.0:
            anomalies.append({
                'type': 'EXCESSIVE_VIBRATION',
                'severity': 'MEDIUM',
                'value': sensor_data['vibration_level'],
                'threshold': 3.0,
                'action': 'Inspect suspension and wheel balance'
            })
        
        return anomalies
    
    def _generate_recommendations(self, health: Dict, failures: List[Dict],
                                   anomalies: List[Dict]) -> List[str]:
        """Generate actionable recommendations."""
        recommendations = []
        
        critical_components = [c for c, d in health.items() if d['status'] == 'CRITICAL']
        if critical_components:
            recommendations.append(
                f"URGENT: Schedule immediate maintenance for {', '.join(critical_components)}"
            )
        
        if failures:
            high_risk = [f for f in failures if f['failure_probability'] > 0.7]
            if high_risk:
                recommendations.append(
                    f"High failure risk detected in {len(high_risk)} component(s) - preventive action required"
                )
        
        if anomalies:
            critical_anomalies = [a for a in anomalies if a['severity'] in ['HIGH', 'CRITICAL']]
            if critical_anomalies:
                recommendations.append(
                    f"Critical anomalies detected - immediate inspection recommended"
                )
        
        if not recommendations:
            recommendations.append("Truck health is good - continue regular maintenance schedule")
        
        return recommendations
    
    def _calculate_overall_health(self, health: Dict) -> float:
        """Calculate overall truck health score."""
        scores = [data['health_score'] for data in health.values()]
        return np.mean(scores)
    
    def _classify_health(self, health: Dict) -> str:
        """Classify overall health status."""
        overall = self._calculate_overall_health(health)
        
        if overall >= 80:
            return 'EXCELLENT'
        elif overall >= 60:
            return 'GOOD'
        elif overall >= 40:
            return 'FAIR'
        elif overall >= 20:
            return 'POOR'
        else:
            return 'CRITICAL'
    
    def _get_status(self, component: str, score: float) -> str:
        """Get component status based on score."""
        thresholds = self.failure_thresholds[component]
        
        if score >= thresholds['good']:
            return 'GOOD'
        elif score >= thresholds['warning']:
            return 'WARNING'
        else:
            return 'CRITICAL'
    
    def _assess_failure_severity(self, component: str, probability: float) -> str:
        """Assess failure severity."""
        critical_components = ['engine', 'transmission', 'brakes']
        
        if component in critical_components and probability > 0.7:
            return 'CRITICAL'
        elif probability > 0.8:
            return 'HIGH'
        elif probability > 0.5:
            return 'MEDIUM'
        else:
            return 'LOW'
    
    def _get_preventive_action(self, component: str) -> str:
        """Get preventive action for component."""
        actions = {
            'engine': 'Schedule engine inspection and oil change',
            'transmission': 'Check transmission fluid and perform service',
            'brakes': 'Inspect brake pads and replace if necessary',
            'tires': 'Check tire pressure and tread depth',
            'suspension': 'Inspect suspension components and bushings',
            'electrical': 'Test battery and electrical system'
        }
        return actions.get(component, 'Schedule inspection')
    
    def _estimate_downtime(self, component: str) -> float:
        """Estimate maintenance downtime in hours."""
        downtimes = {
            'engine': 24,
            'transmission': 16,
            'brakes': 4,
            'tires': 2,
            'suspension': 8,
            'electrical': 6,
            'GENERAL': 4
        }
        return downtimes.get(component, 4)
    
    def _calculate_next_service(self, truck_data: Dict, health: Dict) -> int:
        """Calculate next service mileage."""
        mileage = truck_data.get('mileage_km', 0)
        last_service = truck_data.get('last_service_km', 0)
        
        standard_interval = 10000
        next_standard = last_service + standard_interval
        
        critical_components = [
            c for c, d in health.items()
            if d['status'] == 'CRITICAL' and d['estimated_remaining_km'] < 5000
        ]
        
        if critical_components:
            return mileage + 500
        
        return max(next_standard, mileage + 1000)
    
    def _determine_urgency(self, health: Dict, failures: List[Dict]) -> str:
        """Determine overall maintenance urgency."""
        critical_count = sum(1 for d in health.values() if d['status'] == 'CRITICAL')
        high_risk_failures = sum(1 for f in failures if f['failure_probability'] > 0.7)
        
        if critical_count >= 2 or high_risk_failures >= 1:
            return 'IMMEDIATE'
        elif critical_count >= 1 or high_risk_failures >= 1:
            return 'HIGH'
        elif any(d['status'] == 'WARNING' for d in health.values()):
            return 'MEDIUM'
        else:
            return 'LOW'
