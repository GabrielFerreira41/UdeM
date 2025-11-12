# get_besstie.py
# Télécharge BESSTIE et exporte en CSV/Parquet par split, tâche et (optionnel) variété.

import argparse
from pathlib import Path
import pandas as pd
from datasets import load_dataset

def export_df(df: pd.DataFrame, out_dir: Path, name: str):
    out_dir.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_dir / f"{name}.csv", index=False)
    try:
        df.to_parquet(out_dir / f"{name}.parquet", index=False)
    except Exception:
        pass  # pyarrow facultatif

def main(out_dir: str, variety: str | None):
    # 1) Charger le dataset depuis Hugging Face
    ds = load_dataset("unswnlporg/BESSTIE")  # splits: train / validation

    # 2) Convertir en pandas
    train_df = ds["train"].to_pandas()
    valid_df = ds["validation"].to_pandas()

    # 3) (Optionnel) Filtrer par variété (en-AU, en-IN, en-UK)
    if variety:
        keep = {variety}
        train_df = train_df[train_df["variety"].isin(keep)]
        valid_df = valid_df[valid_df["variety"].isin(keep)]

    # 4) Export global (toutes tâches confondues)
    out = Path(out_dir)
    export_df(train_df, out / "all", "train_all")
    export_df(valid_df, out / "all", "validation_all")

    # 5) Export par tâche (Sentiment / Sarcasm)
    for task_name in sorted(set(train_df["task"]).union(set(valid_df["task"]))):
        t_train = train_df[train_df["task"] == task_name]
        t_valid = valid_df[valid_df["task"] == task_name]
        # Normaliser noms de fichiers
        tslug = task_name.lower()
        export_df(t_train, out / tslug, f"train_{tslug}")
        export_df(t_valid, out / tslug, f"validation_{tslug}")

    # 6) (Optionnel) Export par tâche ET par variété
    if variety:
        for task_name in sorted(set(train_df["task"]).union(set(valid_df["task"]))):
            tslug = task_name.lower()
            vslug = variety.replace("-", "").lower()
            t_train = train_df[train_df["task"] == task_name]
            t_valid = valid_df[valid_df["task"] == task_name]
            export_df(t_train, out / f"{tslug}_{vslug}", f"train_{tslug}_{vslug}")
            export_df(t_valid, out / f"{tslug}_{vslug}", f"validation_{tslug}_{vslug}")

    # 7) Petite info
    print("Exports terminés dans :", out.resolve())
    print("Colonnes disponibles :", list(train_df.columns))

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--out_dir", type=str, default="data/BESSTIE", help="Dossier de sortie")
    parser.add_argument("--variety", type=str, default=None,
                        help="Filtrer par variété (ex: en-AU, en-IN, en-UK). Laisse vide pour tout garder.")
    args = parser.parse_args()
    main(args.out_dir, args.variety)