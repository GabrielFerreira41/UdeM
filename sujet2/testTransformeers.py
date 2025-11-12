# test_transformer_local_by_variety.py
# Test d’un modèle Transformer (DistilBERT) sur BESSTIE local
# + sauvegarde des prédictions et des métriques globales et par variété linguistique

import json
from pathlib import Path
import numpy as np
import pandas as pd
from datasets import Dataset
from transformers import AutoTokenizer, AutoModelForSequenceClassification, TrainingArguments, Trainer
from sklearn.metrics import f1_score, accuracy_score

# ---------- CONFIG ----------
TASK = "sentiment"  # ou "sarcasm"
DATA_DIR = f"./BESSTIE/{TASK}"
MODEL_NAME = "xlm-roberta-base" #distilbert-base-uncased / roberta-base
EPOCHS = 3 
BATCH_SIZE = 16
OUTPUT_DIR = Path(f"./output/{TASK}_{MODEL_NAME.replace('/','-')}")
# ----------------------------

OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# 1️⃣ Charger les CSV locaux
train_df = pd.read_csv(f"{DATA_DIR}/train_{TASK}.csv")
valid_df = pd.read_csv(f"{DATA_DIR}/validation_{TASK}.csv").reset_index(drop=True)

# 2️⃣ Conversion en Dataset Hugging Face
train_dataset = Dataset.from_pandas(train_df)
valid_dataset = Dataset.from_pandas(valid_df)

# 3️⃣ Tokenization
tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)
def tokenize_fn(batch):
    return tokenizer(batch["text"], truncation=True, padding="max_length", max_length=128)

train_dataset = train_dataset.map(tokenize_fn, batched=True)
valid_dataset = valid_dataset.map(tokenize_fn, batched=True)

train_dataset = train_dataset.rename_column("label", "labels")
valid_dataset = valid_dataset.rename_column("label", "labels")
train_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])
valid_dataset.set_format(type="torch", columns=["input_ids", "attention_mask", "labels"])

# 4️⃣ Modèle
model = AutoModelForSequenceClassification.from_pretrained(MODEL_NAME, num_labels=2)

# 5️⃣ Métriques
def compute_metrics(eval_pred):
    logits, labels = eval_pred
    preds = np.argmax(logits, axis=1)
    return {
        "accuracy": accuracy_score(labels, preds),
        "f1_macro": f1_score(labels, preds, average="macro"),
    }

# 6️⃣ Entraînement
args = TrainingArguments(
    output_dir=f"results_{TASK}",
    evaluation_strategy="epoch",
    save_strategy="epoch",
    per_device_train_batch_size=BATCH_SIZE,
    per_device_eval_batch_size=BATCH_SIZE,
    num_train_epochs=EPOCHS,
    learning_rate=2e-5,
    load_best_model_at_end=True,
    metric_for_best_model="f1_macro",
)

trainer = Trainer(
    model=model,
    args=args,
    train_dataset=train_dataset,
    eval_dataset=valid_dataset,
    tokenizer=tokenizer,
    compute_metrics=compute_metrics,
)

trainer.train()
results = trainer.evaluate()
print("\n✅ Résultats globaux :", results)

# 7️⃣ Prédictions sur validation
pred_out = trainer.predict(valid_dataset)
logits = pred_out.predictions
y_true = pred_out.label_ids
y_pred = np.argmax(logits, axis=1)

# Softmax (probas)
exp_logits = np.exp(logits - logits.max(axis=1, keepdims=True))
probas = exp_logits / exp_logits.sum(axis=1, keepdims=True)

# 🔹 Fusionner avec valid_df
pred_df = valid_df.copy()
pred_df["label_true"] = y_true
pred_df["label_pred"] = y_pred
pred_df["proba_0"] = probas[:, 0]
pred_df["proba_1"] = probas[:, 1]

# Sauvegarder les prédictions globales
pred_path = OUTPUT_DIR / "predictions.csv"
pred_df.to_csv(pred_path, index=False)

# 🔹 Calcul des métriques globales
metrics_global = {
    "eval_accuracy": float(results.get("eval_accuracy", 0.0)),
    "eval_f1_macro": float(results.get("eval_f1_macro", 0.0)),
    "eval_loss": float(results.get("eval_loss", 0.0)),
    "samples": int(len(valid_df))
}

# 🔹 Calcul des métriques par variété
metrics_by_variety = {}
if "variety" in pred_df.columns:
    for variety, subset in pred_df.groupby("variety"):
        acc = accuracy_score(subset["label_true"], subset["label_pred"])
        f1 = f1_score(subset["label_true"], subset["label_pred"], average="macro")
        metrics_by_variety[variety] = {
            "samples": len(subset),
            "accuracy": acc,
            "f1_macro": f1
        }
else:
    print("⚠️ Colonne 'variety' absente du dataset — pas de métriques par langue.")

# 🔹 Sauvegarder les fichiers de résultats
metrics_path = OUTPUT_DIR / "metrics_global.json"
with metrics_path.open("w", encoding="utf-8") as f:
    json.dump(metrics_global, f, indent=2)

metrics_by_lang_path = OUTPUT_DIR / "metrics_by_variety.json"
with metrics_by_lang_path.open("w", encoding="utf-8") as f:
    json.dump(metrics_by_variety, f, indent=2)

print(f"\n📊 Métriques globales enregistrées dans : {metrics_path.resolve()}")
print(f"🌍 Métriques par variété enregistrées dans : {metrics_by_lang_path.resolve()}")
print(f"💾 Prédictions complètes dans : {pred_path.resolve()}")
