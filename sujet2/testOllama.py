# test_ollama_llama31_batch.py
# Zero-shot via Ollama (LLaMA 3.1) — traitement par batch de 30 + sauvegardes incrémentales

import os
import time
import json
import subprocess
import pandas as pd
from pathlib import Path
from sklearn.metrics import accuracy_score, f1_score

# ---------- CONFIG ----------
TASK = "sarcasm"           # "sentiment" ou "sarcasm"
DATA_DIR = f"./BESSTIE/{TASK}"
MODEL = "llama3.1"           # nom du modèle Ollama local
OUTPUT_DIR = Path(f"./output/{TASK}_ollama_llama31")
N_SAMPLES = None             # None = tout; ex: 300 pour un échantillon
BATCH_SIZE = 30
SLEEP_BETWEEN_CALLS = 0.4
SLEEP_BETWEEN_BATCHES = 2
# ----------------------------

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

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
    o = str(output).lower()
    if TASK == "sentiment":
        if "pos" in o:
            return 1
        if "neg" in o:
            return 0
        return -1
    else:
        if "sarcastic" in o and "not" not in o:
            return 1
        if "not" in o:
            return 0
        return -1

def query_ollama(prompt: str, model=MODEL) -> str:
    """Interroge Ollama localement et renvoie la réponse texte brute."""
    try:
        result = subprocess.run(
            ["ollama", "run", model],
            input=prompt.encode("utf-8"),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            timeout=60,
        )
        response = result.stdout.decode("utf-8").strip()
        return response
    except subprocess.TimeoutExpired:
        return "timeout"
    except Exception as e:
        print("⚠️ Erreur Ollama:", e)
        return "error"

# --- Charger données ---
df = pd.read_csv(f"{DATA_DIR}/validation_{TASK}.csv")
if N_SAMPLES:
    df = df.sample(N_SAMPLES, random_state=42).reset_index(drop=True)

df["pred_label"] = None
df["raw_output"] = None

pred_path = OUTPUT_DIR / "predictions_ollama_llama31.csv"

# --- Boucle par batch ---
total = len(df)
for start in range(0, total, BATCH_SIZE):
    end = min(start + BATCH_SIZE, total)
    batch = df.iloc[start:end].copy()
    print(f"\n🚀 Batch {start//BATCH_SIZE + 1} — lignes {start} à {end-1} / {total}")

    for idx, row in batch.iterrows():
        text = row["text"]
        prompt = make_prompt(text)
        content = query_ollama(prompt)
        df.at[idx, "raw_output"] = content
        df.at[idx, "pred_label"] = map_output_to_label(content)
        print(f" → {idx}: {content}")
        time.sleep(SLEEP_BETWEEN_CALLS)

    # Sauvegarde incrémentale
    df.to_csv(pred_path, index=False)
    print(f"💾 Sauvegarde intermédiaire → {pred_path}")
    time.sleep(SLEEP_BETWEEN_BATCHES)

# --- Nettoyage et métriques finales ---
df_valid = df[df["pred_label"].isin([0, 1])].copy()
acc = accuracy_score(df_valid["label"], df_valid["pred_label"])
f1 = f1_score(df_valid["label"], df_valid["pred_label"], average="macro")

metrics = {"accuracy": float(acc), "f1_macro": float(f1), "samples": int(len(df_valid))}
with open(OUTPUT_DIR / "metrics_ollama_llama31.json", "w") as f:
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

print("\n✅ Résultats finaux (Ollama LLaMA 3.1)")
print(f"   Accuracy : {acc:.3f} | F1-macro : {f1:.3f} | Samples : {len(df_valid)}")
print(f"📂 Prédictions : {pred_path.resolve()}")
print(f"📊 Métriques  : {(OUTPUT_DIR / 'metrics_ollama_llama31.json').resolve()}")
if metrics_by_variety:
    print(f"🌍 Métriques par variété : {(OUTPUT_DIR / 'metrics_by_variety.json').resolve()}")
