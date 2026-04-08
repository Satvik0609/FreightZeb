import numpy as np
from typing import List, Dict
from sklearn.cluster import DBSCAN
from sklearn.preprocessing import StandardScaler
import logging

logger = logging.getLogger(__name__)


class ShipmentClusterer:
    """
    Clusters shipments with similar destinations for consolidation.
    Uses DBSCAN for density-based clustering.
    """
    
    def __init__(self):
        self.scaler = StandardScaler()
        logger.info("ShipmentClusterer initialized")
    
    def _extract_coordinates(self, shipments: List[Dict]) -> np.ndarray:
        """Extract lat/lng from shipment destination data."""
        coords = []
        for shipment in shipments:
            dest = shipment.get('destination', {})
            if isinstance(dest, dict):
                lat = dest.get('lat', 0)
                lng = dest.get('lng', 0)
            else:
                lat, lng = 0, 0
            coords.append([lat, lng])
        return np.array(coords)
    
    def cluster(self, shipments: List[Dict], eps_km: float = 50, min_samples: int = 2) -> Dict:
        """
        Cluster shipments by destination proximity.
        
        Args:
            shipments: List of shipment dictionaries with destination coordinates
            eps_km: Maximum distance between points in same cluster (kilometers)
            min_samples: Minimum shipments to form a cluster
        
        Returns:
            Clustering results with cluster assignments
        """
        if len(shipments) < 2:
            logger.info("Less than 2 shipments, no clustering needed")
            return {
                'num_clusters': 0,
                'clusters': [],
                'unclustered_count': len(shipments),
                'consolidation_opportunities': 0
            }
        
        coords = self._extract_coordinates(shipments)
        
        if coords.shape[0] == 0 or np.all(coords == 0):
            logger.warning("No valid coordinates found in shipments")
            return {
                'num_clusters': 0,
                'clusters': [],
                'unclustered_count': len(shipments),
                'consolidation_opportunities': 0
            }
        
        eps_degrees = eps_km / 111.0
        
        clustering = DBSCAN(eps=eps_degrees, min_samples=min_samples, metric='euclidean')
        labels = clustering.fit_predict(coords)
        
        clusters = {}
        unclustered = []
        
        for idx, label in enumerate(labels):
            if label == -1:
                unclustered.append({
                    'shipment_id': shipments[idx].get('id', idx),
                    'destination': shipments[idx].get('destination')
                })
            else:
                if label not in clusters:
                    clusters[label] = []
                clusters[label].append({
                    'shipment_id': shipments[idx].get('id', idx),
                    'destination': shipments[idx].get('destination'),
                    'weight_kg': shipments[idx].get('weight_kg', 0),
                    'volume_m3': shipments[idx].get('volume_m3', 0)
                })
        
        cluster_summaries = []
        for cluster_id, members in clusters.items():
            total_weight = sum(m.get('weight_kg', 0) for m in members)
            total_volume = sum(m.get('volume_m3', 0) for m in members)
            
            cluster_coords = [
                [m['destination'].get('lat', 0), m['destination'].get('lng', 0)]
                for m in members if isinstance(m.get('destination'), dict)
            ]
            
            if cluster_coords:
                centroid = np.mean(cluster_coords, axis=0)
            else:
                centroid = [0, 0]
            
            cluster_summaries.append({
                'cluster_id': int(cluster_id),
                'shipment_count': len(members),
                'shipment_ids': [m['shipment_id'] for m in members],
                'total_weight_kg': round(total_weight, 2),
                'total_volume_m3': round(total_volume, 2),
                'centroid': {
                    'lat': round(float(centroid[0]), 6),
                    'lng': round(float(centroid[1]), 6)
                },
                'consolidation_potential': 'HIGH' if len(members) >= 3 else 'MEDIUM'
            })
        
        num_clusters = len(clusters)
        consolidation_opps = sum(1 for c in cluster_summaries if c['shipment_count'] >= 2)
        
        return {
            'num_clusters': num_clusters,
            'clusters': cluster_summaries,
            'unclustered_count': len(unclustered),
            'unclustered_shipments': unclustered,
            'consolidation_opportunities': consolidation_opps,
            'total_shipments': len(shipments),
            'clustering_efficiency': round((len(shipments) - len(unclustered)) / len(shipments) * 100, 2) if shipments else 0
        }
