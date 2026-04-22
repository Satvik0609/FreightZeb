import joblib, pathlib
M = pathlib.Path("saved_models")

for name in ["truck_recommender_v2","delivery_predictor_v2","delay_predictor_v2",
             "fuel_estimator_v2","shipment_clusterer_v2","route_optimizer_v2"]:
    p = M / f"{name}.joblib"
    if not p.exists():
        print(f"{name}: MISSING"); continue
    d = joblib.load(p)
    top = list(d.keys())
    model_keys = list(d.get("model", {}).keys()) if isinstance(d.get("model"), dict) else type(d.get("model")).__name__
    meta = d.get("metadata", {})
    src  = meta.get("data_source", "?")
    print(f"{name}:")
    print(f"  top-level: {top}")
    print(f"  model keys: {model_keys}")
    print(f"  data_source: {src}")
    print()
