# test_mistral_api_batch.py
# Zero-shot via Mistral API — traitement par batch de 30 + sauvegardes incrémentales

import os
import time
import json
import requests
import pandas as pd
from pathlib import Path
from sklearn.metrics import accuracy_score, f1_score
from dotenv import load_dotenv

# ---------- CONFIG ----------
TASK = "sentiment"  # ou "sentiment"
DATA_DIR = f"./BESSTIE/{TASK}"
MODEL = "mistral-large-latest"   # ou "mistral-large-latest"
OUTPUT_DIR = Path(f"./output/{TASK}_mistral_api")
N_SAMPLES = None          # None = tout; ex: 300 pour un échantillon
BATCH_SIZE_API = 30       # ✅ batch de 30
SLEEP_BETWEEN_CALLS = 0.5 # anti-rate-limit (par requête)
SLEEP_BETWEEN_BATCHES = 2 # pause entre lots
API_URL = "https://api.mistral.ai/v1/chat/completions"
# ----------------------------

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
load_dotenv()
API_KEY = "qekLGRGbXv2RqL7sSbTgQzYquDYN7NO1"
if not API_KEY:
    raise ValueError("MISTRAL_API_KEY manquant (exporte la variable d'env ou crée un .env).")

headers = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

# --- Helpers ---
def make_prompt(text: str) -> str:
    if TASK == "sentiment":
        return (
            "Classify the following text as either 'Positive' or 'Negative'. "
            "Respond with only one word: Positive or Negative.\n\n"
            f"Text:\n{text}"
        )
    else:
        return (
            "Determine if the following text contains sarcasm. "
            "Respond only with 'Sarcastic' or 'Not Sarcastic'.\n\n"
            f"Text:\n{text}"
        )

def map_output_to_label(output: str) -> int:
    o = output.lower()
    if TASK == "sentiment":
        if "pos" in o: return 1
        if "neg" in o: return 0
        return -1
    else:
        if "sarcastic" in o and "not" not in o: return 1
        if "not" in o: return 0
        return -1

# --- Charger données ---
df = pd.read_csv(f"{DATA_DIR}/validation_{TASK}.csv")
if N_SAMPLES:
    df = df.sample(N_SAMPLES, random_state=42).reset_index(drop=True)

# Colonnes de sortie
df["pred_label"] = None
df["raw_output"] = None

pred_path = OUTPUT_DIR / "predictions_mistral_api.csv"

# --- Boucle par batch de 30 ---
total = len(df)
for start in range(0, total, BATCH_SIZE_API):
    end = min(start + BATCH_SIZE_API, total)
    batch = df.iloc[start:end].copy()

    print(f"\n🚀 Batch {start//BATCH_SIZE_API + 1} — lignes {start} à {end-1} / {total}")

    for idx, row in batch.iterrows():
        text = row["text"]
        payload = {
            "model": MODEL,
            "messages": [
                {"role": "system", "content": "You are a text classification assistant."},
                {"role": "user", "content": make_prompt(text)}
            ],
            "temperature": 0.0,
            "max_tokens": 20
        }
        try:
            r = requests.post(API_URL, headers=headers, json=payload, timeout=30)
            r.raise_for_status()
            content = r.json()["choices"][0]["message"]["content"].strip()
        except Exception as e:
            print(f"⚠️ Erreur API (ligne {idx}) :", e)
            content = "error"

        df.at[idx, "raw_output"] = content
        df.at[idx, "pred_label"] = map_output_to_label(content)

        time.sleep(SLEEP_BETWEEN_CALLS)  # anti-rate-limit par requête

    # Sauvegarde incrémentale après chaque batch
    df.to_csv(pred_path, index=False)
    print(f"💾 Sauvegarde intermédiaire → {pred_path}")
    time.sleep(SLEEP_BETWEEN_BATCHES)

# --- Nettoyage et métriques finales ---
df_valid = df[df["pred_label"].isin([0, 1])].copy()
acc = accuracy_score(df_valid["label"], df_valid["pred_label"])
f1 = f1_score(df_valid["label"], df_valid["pred_label"], average="macro")

metrics = {"accuracy": float(acc), "f1_macro": float(f1), "samples": int(len(df_valid))}
with open(OUTPUT_DIR / "metrics_mistral_api.json", "w") as f:
    json.dump(metrics, f, indent=2)

# Par variété (si dispo)
metrics_by_variety = {}
if "variety" in df_valid.columns:
    for variety, sub in df_valid.groupby("variety"):
        acc_v = accuracy_score(sub["label"], sub["pred_label"])
        f1_v = f1_score(sub["label"], sub["pred_label"], average="macro")
        metrics_by_variety[variety] = {
            "samples": int(len(sub)),
            "accuracy": float(acc_v),
            "f1_macro": float(f1_v)
        }
    with open(OUTPUT_DIR / "metrics_by_variety.json", "w") as f:
        json.dump(metrics_by_variety, f, indent=2)

print("\n✅ Résultats finaux Mistral API")
print(f"   Accuracy : {acc:.3f} | F1-macro : {f1:.3f} | Samples : {len(df_valid)}")
print(f"📂 Prédictions : {pred_path.resolve()}")
print(f"📊 Métriques  : {(OUTPUT_DIR / 'metrics_mistral_api.json').resolve()}")
if metrics_by_variety:
    print(f"🌍 Métriques par variété : {(OUTPUT_DIR / 'metrics_by_variety.json').resolve()}")
