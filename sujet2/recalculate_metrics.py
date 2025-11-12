import pandas as pd
import json
import sys
import numpy as np
from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    confusion_matrix,
    classification_report
)

# --- Charger le CSV ---
if len(sys.argv) < 2:
    print("Usage: python recalculate_metrics_for_mistral.py predictions_mistral_api.csv")
    sys.exit(1)

csv_path = sys.argv[1]
print(f"📂 Chargement du fichier : {csv_path}")
df = pd.read_csv(csv_path)

# --- Vérif colonnes ---
required = {"label", "pred_label"}
if not required.issubset(df.columns):
    raise ValueError(f"❌ Colonnes manquantes : {required - set(df.columns)}")

# --- Nettoyage des données ---
print("🧹 Nettoyage des labels...")
df = df.dropna(subset=["label", "pred_label"])
df["label"] = df["label"].astype(str).str.strip().str.lower()
df["pred_label"] = df["pred_label"].astype(str).str.strip().str.lower()

# Mappage vers 0/1
mapping = {
    "positive": 1, "pos": 1, "1": 1, "true": 1, "yes": 1, "sarcastic": 1,
    "negative": 0, "neg": 0, "0": 0, "false": 0, "no": 0, "notsarcastic": 0
}
df["label"] = df["label"].map(mapping)
df["pred_label"] = df["pred_label"].map(mapping)

# Supprimer les lignes invalides
df = df.dropna(subset=["label", "pred_label"])
df["label"] = df["label"].astype(int)
df["pred_label"] = df["pred_label"].astype(int)

# --- Fonction métriques ---
def compute_metrics(y_true, y_pred):
    return {
        "accuracy": float(accuracy_score(y_true, y_pred)),
        "precision": float(precision_score(y_true, y_pred, zero_division=0)),
        "recall": float(recall_score(y_true, y_pred, zero_division=0)),
        "f1_score": float(f1_score(y_true, y_pred, zero_division=0)),
        "confusion_matrix": confusion_matrix(y_true, y_pred).tolist(),
        "report": classification_report(y_true, y_pred, digits=4, output_dict=True),
        "support": int(len(y_true))
    }

# --- Calcul global ---
print("\n📊 Calcul des métriques globales...")
metrics_global = compute_metrics(df["label"], df["pred_label"])

# --- Calcul par variété linguistique ---
metrics_by_variety = {}
if "variety" in df.columns:
    print("\n🌍 Calcul des métriques par variété linguistique...")
    for v, sub in df.groupby("variety"):
        m = compute_metrics(sub["label"], sub["pred_label"])
        metrics_by_variety[v] = m
        print(f"  - {v}: acc={m['accuracy']:.4f}, f1={m['f1_score']:.4f}, n={m['support']}")
else:
    print("⚠️ Colonne 'variety' absente — pas de calcul par langue.")

# --- Sauvegarde ---
with open("metrics_global.json", "w", encoding="utf-8") as f:
    json.dump(metrics_global, f, indent=2)
if metrics_by_variety:
    with open("metrics_by_variety.json", "w", encoding="utf-8") as f:
        json.dump(metrics_by_variety, f, indent=2)

print("\n✅ Fichiers générés :")
print("  - metrics_global.json")
if metrics_by_variety:
    print("  - metrics_by_variety.json")
print("✨ Terminé !")
