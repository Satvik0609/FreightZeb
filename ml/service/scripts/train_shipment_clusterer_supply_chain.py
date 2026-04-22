"""
train_shipment_clusterer_supply_chain.py
Retrains ShipmentClusterer V2 using the Supply Chain Dataset
(amirmotefaker/supply-chain-dataset) — 100 rows, 24 real supply chain columns.

With only 100 rows KMeans is run on the full feature set without PCA,
and we use all meaningful numeric + encoded categorical features.
"""
import pathlib, joblib, time
import numpy as np
import pandas as pd
from sklearn.preprocessing import LabelEncoder, StandardScaler
from sklearn.cluster import KMeans, DBSCAN
from sklearn.decomposition import PCA
from sklearn.metrics import silhouette_score, davies_bouldin_score

ROOT = pathlib.Path(__file__).parent
DATA = ROOT / "data/supply_chain/supply_chain_data.csv"
M    = ROOT / "saved_models"

if not DATA.exists():
    raise FileNotFoundError(f"Missing: {DATA}")

print("Loading supply chain dataset...")
df = pd.read_csv(DATA)
print(f"  rows={len(df)}  cols={len(df.columns)}")

# ── Encode categoricals ───────────────────────────────────────────────────────
def enc_col(col):
    le = LabelEncoder()
    df[col + "_enc"] = le.fit_transform(df[col].fillna("Unknown").astype(str))
    return le

enc_col("Transportation modes")   # Road / Air / Sea / Rail
enc_col("Routes")                  # Route A / B / C
enc_col("Shipping carriers")       # Carrier A / B / C
enc_col("Location")                # Mumbai / Delhi / Kolkata etc.
enc_col("Product type")            # haircare / skincare / cosmetics
enc_col("Inspection results")      # Pass / Fail / Pending

# ── Logistics segmentation features ──────────────────────────────────────────
# Focus: HOW shipments move (transport, route, timing, cost efficiency)
# NOT geographic lat/lon — pure logistics behaviour clustering

numeric_logistics = [
    "Shipping times",           # days in transit
    "Shipping costs",           # cost of shipping
    "Lead times",               # supplier lead time
    "Lead time",                # manufacturing lead time
    "Order quantities",         # batch size
    "Stock levels",             # inventory level
    "Defect rates",             # quality signal
    "Manufacturing costs",      # production cost
    "Costs",                    # total logistics cost
    "Production volumes",       # scale of production
]
encoded_logistics = [
    "Transportation modes_enc",
    "Routes_enc",
    "Shipping carriers_enc",
    "Location_enc",
    "Product type_enc",
    "Inspection results_enc",
]

for c in numeric_logistics:
    df[c] = pd.to_numeric(df[c], errors="coerce")

df_clean = df[numeric_logistics + encoded_logistics].dropna()
print(f"  clean rows: {len(df_clean)}")

X = df_clean[numeric_logistics].values.astype(float)

# ── Logistics-specific engineered features ────────────────────────────────────
# These capture the EFFICIENCY and BEHAVIOUR of each shipment lane
cost_per_day       = X[:, 1] / (X[:, 0] + 1e-6)          # shipping cost / shipping time
lead_efficiency    = X[:, 2] / (X[:, 3] + 1e-6)          # supplier lead / mfg lead
order_cost_ratio   = X[:, 4] / (X[:, 8] + 1e-6)          # order qty / total cost
stock_order_ratio  = X[:, 5] / (X[:, 4] + 1e-6)          # stock / order qty (buffer)
quality_cost_ratio = X[:, 6] * X[:, 7]                    # defect rate × mfg cost (risk)
throughput         = X[:, 9] / (X[:, 3] + 1e-6)          # production vol / lead time

X_cat = df_clean[encoded_logistics].values.astype(float)

X_eng = np.column_stack([
    X, X_cat,
    cost_per_day, lead_efficiency, order_cost_ratio,
    stock_order_ratio, quality_cost_ratio, throughput,
])

scaler = StandardScaler()
X_sc   = scaler.fit_transform(X_eng)

# ── Find optimal k via silhouette sweep ───────────────────────────────────────
print("\n  Silhouette sweep:")
best_sil, best_k, best_km = -1, 3, None
for k in range(2, 8):
    km = KMeans(n_clusters=k, init="k-means++", n_init=100,
                max_iter=2000, random_state=42)
    km.fit(X_sc)
    if len(set(km.labels_)) > 1:
        s = silhouette_score(X_sc, km.labels_)
        d = davies_bouldin_score(X_sc, km.labels_)
        print(f"    k={k}  silhouette={s:.4f}  davies_bouldin={d:.4f}")
        if s > best_sil:
            best_sil, best_k, best_km = s, k, km

labels = best_km.labels_
sil    = silhouette_score(X_sc, labels)
dbi    = davies_bouldin_score(X_sc, labels)

print(f"\n  BEST k={best_k}  silhouette={sil:.4f}  davies_bouldin={dbi:.4f}")

# ── Describe each cluster ─────────────────────────────────────────────────────
df_out = df_clean.copy()
df_out["cluster"] = labels
print("\n  Cluster profiles (logistics segmentation):")
for c in range(best_k):
    sub = df_out[df_out["cluster"] == c]
    # Most common transport mode
    mode_col = df.loc[sub.index, "Transportation modes"] if "Transportation modes" in df.columns else None
    mode_str = mode_col.mode()[0] if mode_col is not None and len(mode_col) > 0 else "?"
    print(f"  Cluster {c}: n={len(sub):3d} | "
          f"ship_time={sub['Shipping times'].mean():.1f}d | "
          f"ship_cost=${sub['Shipping costs'].mean():.2f} | "
          f"lead={sub['Lead times'].mean():.1f}d | "
          f"defect={sub['Defect rates'].mean():.3f} | "
          f"mode={mode_str}")

# ── Save ──────────────────────────────────────────────────────────────────────
joblib.dump({
    "model": {
        "kmeans_model":         best_km,
        "dbscan_model":         DBSCAN(eps=0.5, min_samples=3),
        "scaler":               scaler,
        "pca":                  None,
        "silhouette_score":     sil,
        "davies_bouldin_score": dbi,
        "n_clusters":           best_k,
        "feature_cols":         numeric_logistics + encoded_logistics,
        "clustering_type":      "logistics_segmentation",
    },
    "metadata": {
        "model_type":           "KMeans++ (logistics segmentation)",
        "silhouette_score":     sil,
        "davies_bouldin_score": dbi,
        "n_clusters":           best_k,
        "n_train":              len(df_clean),
        "data_source":          "Supply Chain Dataset (amirmotefaker, 100 rows)",
        "clustering_approach":  "Transport mode + Route + Lead time + Cost efficiency",
        "version":              "v2",
    }
}, M / "shipment_clusterer_v2.joblib", compress=3)

print(f"\n  saved shipment_clusterer_v2.joblib")
print(f"\n  FINAL  silhouette = {sil*100:.2f}%")
