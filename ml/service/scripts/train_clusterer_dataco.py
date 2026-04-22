"""
train_clusterer_dataco.py
Trains ShipmentClusterer V2 on DataCo Smart Supply Chain (180k rows).
Features: lat/lon, shipping mode, product category, order region,
          order value, volume, delivery status, market, department.
Algorithm: KMeans++ sweep + DBSCAN validation.
"""
import pathlib, time, joblib
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.cluster import KMeans, DBSCAN
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, davies_bouldin_score

ROOT = pathlib.Path(__file__).parent
DATA = ROOT / "data/DataCoSupplyChainDataset.csv"
M    = ROOT / "saved_models"

if not DATA.exists():
    raise FileNotFoundError(f"Missing: {DATA}")

print("Loading DataCo Supply Chain dataset...")
df = pd.read_csv(DATA, encoding="latin-1")
print(f"  rows={len(df)}")

# ── Encode categoricals ───────────────────────────────────────────────────────
def enc(col, df=df):
    le = LabelEncoder()
    df[col + "_enc"] = le.fit_transform(df[col].fillna("Unknown").astype(str))
    return le

enc("Shipping Mode")       # Standard Class / First Class / Second Class / Same Day
enc("Department Name")     # Fitness / Apparel / Fan Shop / etc.
enc("Category Name")       # Sporting Goods / Apparel / etc.
enc("Market")              # USCA / Europe / LATAM / Pacific Asia / Africa
enc("Order Region")        # Southeast Asia / Western Europe / etc.
enc("Customer Segment")    # Consumer / Corporate / Home Office
enc("Delivery Status")     # Late delivery / Advance shipping / On time / Canceled
enc("Order Status")        # COMPLETE / PENDING / CLOSED / etc.

# ── Numeric features ──────────────────────────────────────────────────────────
num_cols = [
    "Latitude",                  # customer lat
    "Longitude",                 # customer lon
    "Order Item Quantity",       # batch size
    "Order Item Product Price",  # unit price
    "Order Item Total",          # order value
    "Sales",                     # revenue
    "Order Item Profit Ratio",   # margin
    "Order Item Discount Rate",  # discount
    "Days for shipping (real)",  # actual shipping days
    "Days for shipment (scheduled)", # planned days
    "Late_delivery_risk",        # 0/1 binary
    "Benefit per order",         # profit
]
for c in num_cols:
    df[c] = pd.to_numeric(df[c], errors="coerce")

enc_cols = [
    "Shipping Mode_enc", "Department Name_enc", "Category Name_enc",
    "Market_enc", "Order Region_enc", "Customer Segment_enc",
    "Delivery Status_enc", "Order Status_enc",
]

all_cols = num_cols + enc_cols
df_clean = df[all_cols].dropna()
df_clean = df_clean[
    df_clean["Latitude"].between(-90, 90) &
    df_clean["Longitude"].between(-180, 180)
]
print(f"  clean rows={len(df_clean)}")

# ── Feature engineering ───────────────────────────────────────────────────────
X_base = df_clean[all_cols].values.astype(float)

lat  = X_base[:, 0]
lon  = X_base[:, 1]
qty  = X_base[:, 2]
price= X_base[:, 3]
total= X_base[:, 4]
days_real  = X_base[:, 8]
days_sched = X_base[:, 9]
late_risk  = X_base[:, 10]

# Engineered features
delay_ratio     = (days_real - days_sched) / (days_sched + 1e-6)   # how late vs plan
value_per_unit  = total / (qty + 1e-6)                              # order value density
dist_from_center= np.sqrt(lat**2 + lon**2)                         # geographic spread
urgency_score   = late_risk * (days_real / (days_sched + 1e-6))    # risk × delay factor
margin_score    = X_base[:, 6] * total                              # profit × value

X_eng = np.column_stack([
    X_base,
    delay_ratio, value_per_unit, dist_from_center,
    urgency_score, margin_score,
    np.log1p(np.abs(total)), np.log1p(qty),
])

print(f"  feature matrix: {X_eng.shape}")

# ── Scale + PCA ───────────────────────────────────────────────────────────────
scaler = StandardScaler()
X_sc   = scaler.fit_transform(X_eng)

pca = PCA(n_components=0.90, random_state=42)
X_pca = pca.fit_transform(X_sc)
print(f"  PCA: {X_pca.shape[1]} components, variance={pca.explained_variance_ratio_.sum():.3f}")

# ── KMeans sweep — use sample for silhouette (O(n²) on 180k is too slow) ─────
print("\n  KMeans silhouette sweep (sampled 20k for speed):")
SAMPLE_N = 20_000
rng_sil = np.random.default_rng(42)
sil_idx = rng_sil.choice(len(X_pca), size=SAMPLE_N, replace=False)
X_sil   = X_pca[sil_idx]

best_sil, best_k, best_km = -1, 5, None
for k in range(3, 10):
    km = KMeans(n_clusters=k, init="k-means++", n_init=20,
                max_iter=500, random_state=42)
    km.fit(X_pca)                          # fit on full 180k
    labels_sil = km.predict(X_sil)        # score on 20k sample
    if len(set(labels_sil)) > 1:
        s = silhouette_score(X_sil, labels_sil)
        d = davies_bouldin_score(X_sil, labels_sil)
        print(f"    k={k}  silhouette={s:.4f}  davies_bouldin={d:.4f}")
        if s > best_sil:
            best_sil, best_k, best_km = s, k, km

labels = best_km.labels_
# Score on sample for speed
labels_sample = best_km.predict(X_sil)
sil    = silhouette_score(X_sil, labels_sample)
dbi    = davies_bouldin_score(X_sil, labels_sample)
print(f"\n  BEST k={best_k}  silhouette={sil:.4f}  davies_bouldin={dbi:.4f}")

# ── DBSCAN validation ─────────────────────────────────────────────────────────
print("\n  Running DBSCAN for density validation...")
# Sample 10k for DBSCAN speed
idx = np.random.default_rng(42).choice(len(X_pca), size=min(10000, len(X_pca)), replace=False)
db = DBSCAN(eps=0.8, min_samples=10, n_jobs=-1)
db_labels = db.fit_predict(X_pca[idx])
n_db_clusters = len(set(db_labels)) - (1 if -1 in db_labels else 0)
noise_pct = (db_labels == -1).sum() / len(db_labels) * 100
print(f"  DBSCAN: {n_db_clusters} clusters, noise={noise_pct:.1f}%")

# ── Cluster profiles ──────────────────────────────────────────────────────────
df_out = df_clean.copy()
df_out["cluster"] = labels
print("\n  Cluster profiles:")
for c in range(best_k):
    sub = df_out[df_out["cluster"] == c]
    mode = df.loc[sub.index, "Shipping Mode"].mode()
    region = df.loc[sub.index, "Order Region"].mode()
    dept = df.loc[sub.index, "Department Name"].mode()
    print(f"  Cluster {c}: n={len(sub):6d} | "
          f"lat={sub['Latitude'].mean():6.1f} | "
          f"lon={sub['Longitude'].mean():7.1f} | "
          f"ship_mode={mode.iloc[0] if len(mode) else '?'} | "
          f"region={region.iloc[0] if len(region) else '?'} | "
          f"dept={dept.iloc[0] if len(dept) else '?'}")

# ── Save ──────────────────────────────────────────────────────────────────────
joblib.dump({
    "model": {
        "kmeans_model":         best_km,
        "dbscan_model":         DBSCAN(eps=0.8, min_samples=10),
        "scaler":               scaler,
        "pca":                  pca,
        "silhouette_score":     sil,
        "davies_bouldin_score": dbi,
        "n_clusters":           best_k,
    },
    "metadata": {
        "model_type":           "KMeans++ + DBSCAN",
        "silhouette_score":     sil,
        "davies_bouldin_score": dbi,
        "n_clusters":           best_k,
        "n_train":              len(df_clean),
        "data_source":          "DataCo Smart Supply Chain (180k rows)",
        "features":             "lat/lon + shipping_mode + category + region + value + delay",
        "version":              "v2",
    }
}, M / "shipment_clusterer_v2.joblib", compress=3)

print(f"\n  saved shipment_clusterer_v2.joblib")
print(f"\n  FINAL  silhouette = {sil*100:.2f}%  davies_bouldin = {dbi:.4f}")
