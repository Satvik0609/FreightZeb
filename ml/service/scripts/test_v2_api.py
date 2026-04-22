"""
Quick test script for V2 models API endpoints.
"""

import requests
import json

BASE_URL = "http://localhost:8000"

def test_v2_endpoints():
    print("\n" + "="*70)
    print("Testing FreightZen V2 ML API Endpoints")
    print("="*70)
    
    # Test 1: Truck Recommendation V2
    print("\n1️⃣  Testing /v2/predict-truck...")
    response = requests.post(f"{BASE_URL}/v2/predict-truck", json={
        "weight_kg": 5000,
        "volume_m3": 15,
        "distance_km": 500,
        "cargo_type": "GENERAL",
        "priority": "HIGH"
    })
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Recommended: {result['recommended_truck']}")
        print(f"   📊 Confidence: {result['confidence']:.3f}")
        print(f"   🎯 Accuracy: {result['model_accuracy']:.2%}")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 2: Delivery Prediction V2
    print("\n2️⃣  Testing /v2/predict-delivery-time...")
    response = requests.post(f"{BASE_URL}/v2/predict-delivery-time", json={
        "weight_kg": 5000,
        "distance_km": 500,
        "truck_type": "CONTAINER_20FT",
        "traffic_condition": "MODERATE",
        "weather_condition": "CLEAR"
    })
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Predicted: {result['predicted_hours']:.2f} hours")
        print(f"   📊 R² Score: {result['model_r2_score']:.4f}")
        print(f"   🎯 MAE: {result['model_mae_hours']:.2f} hours")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 3: Shipment Clustering V2
    print("\n3️⃣  Testing /v2/cluster-shipments...")
    response = requests.post(f"{BASE_URL}/v2/cluster-shipments", json={
        "shipments": [
            {"latitude": 40.7128, "longitude": -74.0060, "weight_kg": 5000, "volume_m3": 15},
            {"latitude": 40.7580, "longitude": -73.9855, "weight_kg": 3000, "volume_m3": 10},
            {"latitude": 34.0522, "longitude": -118.2437, "weight_kg": 8000, "volume_m3": 25}
        ]
    })
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Clusters: {result['n_clusters']}")
        print(f"   📊 Silhouette Score: {result['silhouette_score']:.4f}")
        print(f"   🎯 Total Shipments: {result['total_shipments']}")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 4: Fuel Estimation V2
    print("\n4️⃣  Testing /v2/estimate-fuel...")
    response = requests.post(f"{BASE_URL}/v2/estimate-fuel", json={
        "distance_km": 500,
        "weight_kg": 5000,
        "truck_type": "CONTAINER_20FT"
    })
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Fuel: {result['estimated_liters']:.2f} liters")
        print(f"   💰 Cost: ${result['estimated_cost']:.2f}")
        print(f"   📊 R² Score: {result['model_r2_score']:.4f}")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    # Test 5: Models Info
    print("\n5️⃣  Testing /v2/models/info...")
    response = requests.get(f"{BASE_URL}/v2/models/info")
    if response.status_code == 200:
        result = response.json()
        print(f"   ✅ Version: {result['version']}")
        print(f"   📊 Models Loaded: {len(result['models'])}")
        for model_name, model_info in result['models'].items():
            print(f"      • {model_name}: {model_info['algorithm']}")
    else:
        print(f"   ❌ Failed: {response.status_code}")
    
    print("\n" + "="*70)
    print("✅ All V2 API tests completed!")
    print("="*70 + "\n")


if __name__ == "__main__":
    try:
        test_v2_endpoints()
    except requests.exceptions.ConnectionError:
        print("\n❌ Error: ML service is not running!")
        print("   Start it with: python main.py")
        print("   Or: uvicorn main:app --reload\n")
