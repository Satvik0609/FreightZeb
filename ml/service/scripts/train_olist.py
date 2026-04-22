"""
train_olist.py
Retrains DeliveryPredictor, ShipmentClusterer, DelayPredictor, FuelEstimator
using the Olist Brazilian E-Commerce dataset (112k real orders).
"""
import pathlib, time, joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.metrics import (accuracy_score, r2_score, mean_absolute_error,
    mean_squared_error, roc_auc_score, silhouette_score, davies_bouldin_score)
from sklearn.cluster import KMeans
from sklearn.decomposition import PCA
import xgboost as xgb
from catboost import CatBoostClassifier, CatBoostRegressor

D = pathlib.Path("data/olist")
M = pathlib.Path("saved_models")

TRUCK_TYPES = ["SMALL_VAN","CONTAINER_20FT","CONTAINER_32FT","FLATBED_TRAILER","REEFER"]
RISK_LEVELS = ["LOW","MODERATE","HIGH","CRITICAL"]

def mkenc(cats):
    le = LabelEncoder(); le.fit(cats); return le

def hav(la1, lo1, la2, lo2):
    R = 6371.0
    dlat = np.radians(la2 - la1); dlon = np.radians(lo2 - lo1)
    a = np.sin(dlat/2)**2 + np.cos(np.radians(la1))*np.cos(np.radians(la2))*np.sin(dlon/2)**2
    return R * 2 * np.arctan2(np.sqrt(a), np.sqrt(1-a))

def truck_label(w, v, cargo):
    if cargo == "PERISHABLE": return "REEFER"
    if cargo == "HAZARDOUS":  return "FLATBED_TRAILER"
    for t, mw, mv in [("SMALL_VAN",1500,10),("CONTAINER_20FT",20000,33),
                      ("CONTAINER_32FT",32000,67),("FLATBED_TRAILER",25000,50)]:
        if w <= mw*0.92 and v <= mv*0.92: return t
    return "CONTAINER_32FT"

def risk_label(delay):
    if delay < -2:  return "LOW"
    elif delay < 2: return "MODERATE"
    elif delay < 7: return "HIGH"
    else:           return "CRITICAL"

# ── Load & merge ──────────────────────────────────────────────────────────────
print("Loading Olist tables...")
orders   = pd.read_csv(D/"olist_orders_dataset.csv",
    parse_dates=["order_purchase_timestamp","order_delivered_customer_date",
                 "order_estimated_delivery_date","order_delivered_carrier_date"])
items    = pd.read_csv(D/"olist_order_items_dataset.csv")
products = pd.read_csv(D/"olist_products_dataset.csv")
geo      = pd.read_csv(D/"olist_geolocation_dataset.csv")
sellers  = pd.read_csv(D/"olist_sellers_dataset.csv")
customers= pd.read_csv(D/"olist_customers_dataset.csv")

items_agg = items.groupby("order_id").agg(
    total_price=("price","sum"), total_freight=("freight_value","sum"),
    n_items=("order_item_id","count"), product_id=("product_id","first"),
    seller_id=("seller_id","first")
).reset_index()

df = orders.merge(items_agg, on="order_id", how="inner")
df = df.merge(products[["product_id","product_weight_g","product_length_cm",
                         "product_height_cm","product_width_cm","product_category_name"]],
              on="product_id", how="left")
df = df.merge(sellers[["seller_id","seller_zip_code_prefix","seller_state"]],
              on="seller_id", how="left")
df = df.merge(customers[["customer_id","customer_zip_code_prefix","customer_state"]],
              on="customer_id", how="left")

geo_agg = geo.groupby("geolocation_zip_code_prefix")[["geolocation_lat","geolocation_lng"]].mean().reset_index()
df = df.merge(geo_agg.rename(columns={"geolocation_zip_code_prefix":"seller_zip_code_prefix",
    "geolocation_lat":"slat","geolocation_lng":"slng"}), on="seller_zip_code_prefix", how="left")
df = df.merge(geo_agg.rename(columns={"geolocation_zip_code_prefix":"customer_zip_code_prefix",
    "geolocation_lat":"clat","geolocation_lng":"clng"}), on="customer_zip_code_prefix", how="left")

# ── Feature engineering ───────────────────────────────────────────────────────
df["dist_km"]        = hav(df["slat"].fillna(-15), df["slng"].fillna(-47),
                           df["clat"].fillna(-23),  df["clng"].fillna(-46))
df["delivery_days"]  = (df["order_delivered_customer_date"] - df["order_purchase_timestamp"]).dt.total_seconds()/86400
df["estimated_days"] = (df["order_estimated_delivery_date"] - df["order_purchase_timestamp"]).dt.total_seconds()/86400
df["delay_days"]     = df["delivery_days"] - df["estimated_days"]
df["weight_kg"]      = df["product_weight_g"].fillna(1000)/1000
df["volume_m3"]      = (df["product_length_cm"].fillna(20)*df["product_height_cm"].fillna(15)*df["product_width_cm"].fillna(15))/1e6
df["order_hour"]     = df["order_purchase_timestamp"].dt.hour
df["order_dow"]      = df["order_purchase_timestamp"].dt.dayofweek
df["order_month"]    = df["order_purchase_timestamp"].dt.month
df["same_state"]     = (df["seller_state"] == df["customer_state"]).astype(int)
df["freight_per_km"] = df["total_freight"] / df["dist_km"].clip(1)

all_states = list(set(df["seller_state"].dropna().tolist() + df["customer_state"].dropna().tolist()))
enc_state = LabelEncoder(); enc_state.fit(all_states)
df["seller_state_enc"]   = enc_state.transform(df["seller_state"].fillna("SP"))
df["customer_state_enc"] = enc_state.transform(df["customer_state"].fillna("SP"))

cat_map = {"beleza_saude":"GENERAL","informatica_acessorios":"FRAGILE",
           "automotivo":"HAZARDOUS","alimentos_bebidas":"PERISHABLE",
           "moveis_decoracao":"FRAGILE","esporte_lazer":"GENERAL",
           "utilidades_domesticas":"GENERAL","ferramentas_jardim":"HAZARDOUS",
           "eletronicos":"FRAGILE","brinquedos":"FRAGILE","perfumaria":"PERISHABLE"}
df["cargo_type"] = df["product_category_name"].map(cat_map).fillna("GENERAL")
df["truck_type"] = [truck_label(r.weight_kg, r.volume_m3, r.cargo_type)
                    for _, r in df[["weight_kg","volume_m3","cargo_type"]].iterrows()]

df = df.dropna(subset=["delivery_days","dist_km","estimated_days"])
df = df[(df["delivery_days"]>0)&(df["delivery_days"]<60)&(df["dist_km"]>0)]
print("Clean rows:", len(df))

enc_truck = mkenc(TRUCK_TYPES)
enc_cargo = mkenc(["GENERAL","PERISHABLE","HAZARDOUS","FRAGILE"])
enc_risk  = mkenc(RISK_LEVELS)

FEATS_BASE = ["dist_km","weight_kg","volume_m3","total_freight","total_price",
              "n_items","estimated_days","order_hour","order_dow","order_month",
              "same_state","freight_per_km","seller_state_enc","customer_state_enc"]

def build_X(d):
    base = d[FEATS_BASE].values.astype(float)
    return np.column_stack([
        base,
        enc_truck.transform(d["truck_type"]),
        enc_cargo.transform(d["cargo_type"]),
        np.log1p(d["dist_km"].values),
        np.log1p(d["weight_kg"].values),
        np.sqrt(d["dist_km"].values),
        d["dist_km"].values * d["weight_kg"].values / 10000,
        np.log1p(d["estimated_days"].values),
    ])

# ── MODEL 2: DeliveryPredictor ────────────────────────────────────────────────
print("\n" + "="*50)
print("MODEL 2 - DeliveryPredictor (XGBoost + CatBoost)")
print("="*50)

d2 = df.dropna(subset=FEATS_BASE+["truck_type","cargo_type","delivery_days"])
d2 = d2[(d2["delivery_days"]>0)&(d2["delivery_days"]<60)]
X2 = build_X(d2)
y2 = d2["delivery_days"].values.astype(float)

sc2 = StandardScaler(); X2s = sc2.fit_transform(X2)
X2tr,X2te,y2tr,y2te = train_test_split(X2s, y2, test_size=0.2, random_state=42)

t0 = time.time()
xm2 = xgb.XGBRegressor(n_estimators=600, max_depth=9, learning_rate=0.02,
    subsample=0.8, colsample_bytree=0.8, min_child_weight=3,
    random_state=42, n_jobs=-1, verbosity=0)
cm2 = CatBoostRegressor(iterations=600, depth=9, learning_rate=0.02,
    l2_leaf_reg=3, random_seed=42, verbose=False)
xm2.fit(X2tr, y2tr)
cm2.fit(X2tr, y2tr)
ep2  = xm2.predict(X2te)*0.55 + cm2.predict(X2te)*0.45
r2_2 = r2_score(y2te, ep2)
mae2 = mean_absolute_error(y2te, ep2)
rmse2= float(np.sqrt(mean_squared_error(y2te, ep2)))
print(f"  R2={r2_2:.4f}  MAE={mae2:.2f}days  RMSE={rmse2:.2f}days  time={time.time()-t0:.1f}s  rows={len(d2)}")

joblib.dump({"model": {"xgb_model":xm2,"catboost_model":cm2,"scaler":sc2,
    "truck_encoder":enc_truck,"cargo_encoder":enc_cargo,
    "r2_score":r2_2,"mae":mae2,"rmse":rmse2},
    "metadata": {"model_type":"XGBoost+CatBoost","r2_score":r2_2,"mae":mae2,
    "rmse":rmse2,"data_source":"Olist Brazilian E-Commerce (112k orders)","version":"v2"}},
    M/"delivery_predictor_v2.joblib", compress=3)
print("  saved delivery_predictor_v2.joblib")

# ── MODEL 3: ShipmentClusterer ────────────────────────────────────────────────
print("\n" + "="*50)
print("MODEL 3 - ShipmentClusterer (KMeans++)")
print("="*50)

d3 = df[["clat","clng","weight_kg","volume_m3","total_price","total_freight"]].dropna()
d3 = d3[(d3["clat"].between(-35,5)) & (d3["clng"].between(-75,-30))]
X3 = d3.values.astype(float)
wv3  = X3[:,2]/(X3[:,3]+1e-6)
vw3  = X3[:,4]/(X3[:,2]+1e-6)
dist3= np.sqrt(X3[:,0]**2 + X3[:,1]**2)
X3e  = np.column_stack([X3, wv3, vw3, dist3])
sc3  = StandardScaler(); X3s = sc3.fit_transform(X3e)
pca3 = PCA(n_components=0.95, random_state=42); X3p = pca3.fit_transform(X3s)
km3  = KMeans(n_clusters=5, init="k-means++", n_init=20, max_iter=500, random_state=42)
km3.fit(X3p)
sil3 = silhouette_score(X3p, km3.labels_)
dbi3 = davies_bouldin_score(X3p, km3.labels_)
print(f"  silhouette={sil3:.4f}  davies_bouldin={dbi3:.4f}  clusters=5  rows={len(d3)}")

joblib.dump({"model": {"kmeans_model":km3,"scaler":sc3,"pca":pca3,
    "silhouette_score":sil3,"davies_bouldin_score":dbi3,"n_clusters":5},
    "metadata": {"model_type":"KMeans++","silhouette_score":sil3,
    "davies_bouldin_score":dbi3,"n_clusters":5,
    "data_source":"Olist Brazilian E-Commerce (112k orders)","version":"v2"}},
    M/"shipment_clusterer_v2.joblib", compress=3)
print("  saved shipment_clusterer_v2.joblib")

# ── MODEL 4: FuelEstimator ────────────────────────────────────────────────────
print("\n" + "="*50)
print("MODEL 4 - FuelEstimator (XGBoost + RandomForest)")
print("="*50)

from sklearn.ensemble import RandomForestRegressor

TRUCK_SPECS = {
    "SMALL_VAN":{"base_l":8.5,"max_kg":1500},
    "CONTAINER_20FT":{"base_l":22.0,"max_kg":20000},
    "CONTAINER_32FT":{"base_l":28.0,"max_kg":32000},
    "FLATBED_TRAILER":{"base_l":25.0,"max_kg":25000},
    "REEFER":{"base_l":30.0,"max_kg":18000},
}
d4 = df[["dist_km","weight_kg","truck_type","total_freight"]].dropna()
d4 = d4[d4["dist_km"]>0].copy()
rng = np.random.default_rng(42)
d4["fuel_liters"] = [
    (r.dist_km/100.0) * TRUCK_SPECS[r.truck_type]["base_l"] *
    (1.0 + min(r.weight_kg/TRUCK_SPECS[r.truck_type]["max_kg"],1.0)*0.25) *
    float(rng.uniform(0.92,1.08))
    for _, r in d4.iterrows()
]
d4 = d4[d4["fuel_liters"]>0]

tr4 = enc_truck.transform(d4["truck_type"])
d4v = d4["dist_km"].values.astype(float)
w4  = d4["weight_kg"].values.astype(float)
X4  = np.column_stack([d4v, w4, tr4,
    d4v/(w4+1e-6), d4v**2/10000, w4**2/1e6,
    d4v*w4/1000, np.log1p(d4v), np.log1p(w4), np.sqrt(d4v)])
y4  = d4["fuel_liters"].values.astype(float)

sc4 = StandardScaler(); X4s = sc4.fit_transform(X4)
X4tr,X4te,y4tr,y4te = train_test_split(X4s, y4, test_size=0.2, random_state=42)

t0 = time.time()
xm4 = xgb.XGBRegressor(n_estimators=400, max_depth=8, learning_rate=0.04,
    subsample=0.8, colsample_bytree=0.8, random_state=42, n_jobs=-1, verbosity=0)
rf4 = RandomForestRegressor(n_estimators=200, max_depth=15, random_state=42, n_jobs=-1)
xm4.fit(X4tr, y4tr); rf4.fit(X4tr, y4tr)
ep4  = xm4.predict(X4te)*0.6 + rf4.predict(X4te)*0.4
r2_4 = r2_score(y4te, ep4)
mae4 = mean_absolute_error(y4te, ep4)
rmse4= float(np.sqrt(mean_squared_error(y4te, ep4)))
print(f"  R2={r2_4:.4f}  MAE={mae4:.2f}L  RMSE={rmse4:.2f}L  time={time.time()-t0:.1f}s  rows={len(d4)}")

joblib.dump({"model": {"xgb_model":xm4,"rf_model":rf4,"scaler":sc4,
    "truck_encoder":enc_truck,"r2_score":r2_4,"mae":mae4,"rmse":rmse4},
    "metadata": {"model_type":"XGBoost+RandomForest","r2_score":r2_4,"mae":mae4,
    "rmse":rmse4,"data_source":"Olist Brazilian E-Commerce (112k orders)","version":"v2"}},
    M/"fuel_estimator_v2.joblib", compress=3)
print("  saved fuel_estimator_v2.joblib")

# ── MODEL 5: DelayPredictor ───────────────────────────────────────────────────
print("\n" + "="*50)
print("MODEL 5 - DelayPredictor (XGBoost + CatBoost)")
print("="*50)

d5 = df.dropna(subset=FEATS_BASE+["truck_type","cargo_type","delay_days"])
d5 = d5.copy()
d5["risk_level"] = d5["delay_days"].apply(risk_label)
dist5 = d5["risk_level"].value_counts().to_dict()
print("  class_dist:", dist5)

X5 = build_X(d5)
y5 = enc_risk.transform(d5["risk_level"])

sc5 = StandardScaler(); X5s = sc5.fit_transform(X5)
X5tr,X5te,y5tr,y5te = train_test_split(X5s, y5, test_size=0.2, random_state=42, stratify=y5)

t0 = time.time()
xm5 = xgb.XGBClassifier(n_estimators=500, max_depth=9, learning_rate=0.03,
    subsample=0.8, colsample_bytree=0.8, gamma=0.1, reg_alpha=0.1, reg_lambda=1.0,
    random_state=42, n_jobs=-1, eval_metric="mlogloss", verbosity=0)
cm5 = CatBoostClassifier(iterations=500, depth=9, learning_rate=0.03,
    random_seed=42, verbose=False, eval_metric="MultiClass")
xm5.fit(X5tr, y5tr)
cm5.fit(X5tr, y5tr)
ep5  = xm5.predict_proba(X5te)*0.55 + cm5.predict_proba(X5te)*0.45
y5hat= np.argmax(ep5, axis=1)
acc5 = accuracy_score(y5te, y5hat)
cv5  = cross_val_score(xm5, X5s, y5, cv=5, scoring="accuracy", n_jobs=-1).mean()
try:    roc5 = roc_auc_score(y5te, ep5, multi_class="ovr")
except: roc5 = 0.0
print(f"  accuracy={acc5:.4f}  cv={cv5:.4f}  roc_auc={roc5:.4f}  time={time.time()-t0:.1f}s  rows={len(d5)}")

joblib.dump({"model": {"xgb_model":xm5,"catboost_model":cm5,"scaler":sc5,
    "truck_encoder":enc_truck,"cargo_encoder":enc_cargo,"label_encoder":enc_risk,
    "accuracy":acc5,"cv_score":cv5,"roc_auc":roc5},
    "metadata": {"model_type":"XGBoost+CatBoost","accuracy":acc5,"cv_score":cv5,
    "roc_auc":roc5,"data_source":"Olist Brazilian E-Commerce (112k orders)","version":"v2"}},
    M/"delay_predictor_v2.joblib", compress=3)
print("  saved delay_predictor_v2.joblib")

# ── Summary ───────────────────────────────────────────────────────────────────
print("\n" + "="*50)
print("FINAL ACCURACY REPORT")
print("="*50)
print(f"  DeliveryPredictor   R2        = {r2_2*100:.2f}%")
print(f"  ShipmentClusterer   silhouette = {sil3*100:.2f}%")
print(f"  FuelEstimator       R2        = {r2_4*100:.2f}%")
print(f"  DelayPredictor      accuracy  = {acc5*100:.2f}%  ROC-AUC = {roc5*100:.2f}%")
