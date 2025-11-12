from __future__ import annotations

import argparse
import csv
import re
from collections import defaultdict
from typing import Any

from acl_anthology import Anthology
import matplotlib.pyplot as plt
import json
import requests
from bs4 import BeautifulSoup
from tqdm import tqdm
# --- Récupération du résumé depuis la page web ACL ---------------------------

def fetch_abstract_from_web(url: str) -> str:
    """Tente de récupérer le résumé depuis la page web ACL si absent des métadonnées."""
    try:
        response = requests.get(url, timeout=10)
        response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        abstract_div = soup.find("div", class_="card-body acl-abstract")
        if abstract_div:
            return abstract_div.text.strip()
    except Exception:
        pass
    return ""

# --- Utils --------------------------------------------------------------------

def safe_text(value: Any) -> str:
    """Convertit proprement les objets MarkupText (ou None) en texte brut."""
    if value is None:
        return ""
    if hasattr(value, "text"):
        return str(value.text)
    return str(value)


def paper_authors_str(paper: Any) -> str:
    """Convertit la liste d'auteurs en texte lisible."""
    authors = getattr(paper, "authors", None)
    if not authors:
        return ""
    names = []
    for a in authors:
        name_obj = getattr(a, "name", None)
        if name_obj and hasattr(name_obj, "first") and hasattr(name_obj, "last"):
            names.append(f"{name_obj.first} {name_obj.last}".strip())
        elif hasattr(a, "fullname"):
            names.append(str(a.fullname))
        else:
            names.append(str(a))
    return ", ".join(names)


def paper_field(paper: Any, *names: str, default: str = "") -> str:
    """Lecture sécurisée d'un attribut avec fallback."""
    for n in names:
        if hasattr(paper, n):
            val = getattr(paper, n)
            if val:
                return str(val)
    return default


# --- Parcours robuste de l'anthology -----------------------------------------

def iter_papers(anthology: Any):
    """Version moderne et robuste pour parcourir tous les articles de l'Anthology."""
    # ✅ API moderne
    if hasattr(anthology, "iterpapers") and callable(anthology.iterpapers):
        for paper in anthology.iterpapers():
            pid = getattr(paper, "anthology_id", None) or getattr(paper, "id", None)
            yield str(pid), paper
        return

    # ✅ volumes → papers
    if hasattr(anthology, "volumes"):
        vols = anthology.volumes
        if callable(vols):
            vols = vols()
        for vol in vols or []:
            papers = getattr(vol, "papers", None)
            if callable(papers):
                papers = papers()
            for i, paper in enumerate(papers or []):
                yield f"{getattr(vol, 'id', 'vol')}_{i}", paper
        return

    # ✅ venues → volumes → papers
    if hasattr(anthology, "venues"):
        venues = anthology.venues
        if callable(venues):
            venues = venues()
        for vid, venue in venues.items() if isinstance(venues, dict) else enumerate(venues):
            vols = getattr(venue, "volumes", None)
            if callable(vols):
                vols = vols()
            for vol in vols or []:
                papers = getattr(vol, "papers", None)
                if callable(papers):
                    papers = papers()
                for i, paper in enumerate(papers or []):
                    yield f"{vid}_{i}", paper
        return

    print("⚠️ Aucun papier trouvé. Vérifie la version du module ou le chemin du dépôt.")
    return


def extract_paper_info(paper: Any) -> dict:
    """Rassemble les métadonnées importantes d'un article."""
    title = paper_field(paper, "title", "paper_title")
    year = paper_field(paper, "year")
    pdf = getattr(getattr(paper, "pdf", None), "name", "")
    pdf_url = getattr(paper, "web_url", "")
    doi = getattr(paper, "doi", "")
    venue = ", ".join(getattr(paper, "venue_ids", []))
    address = paper_field(paper, "address", default="")
    authors = paper_authors_str(paper)
    abstract = paper_field(paper, "abstract", default="")
    if not abstract and pdf_url:
        abstract = fetch_abstract_from_web(pdf_url)
    return {
        "title": title,
        "year": year,
        "authors": authors,
        "venue": venue,
        "address": address,
        "abstract": abstract,
        "pdf_url": pdf_url,
        "doi": doi,
    }


# --- Cartographie classification / benchmarks --------------------------------

def cartographie_classification(anthology: Any, limit: int = 0) -> dict:
    """
    Cartographie des papiers 'classification / benchmarks' dans :
    ACL (incl. NAACL, EACL), CoNLL, EMNLP, COLING, LREC, Findings.
    Affiche statistiques + exemples + comptage par année.
    """
    # Conférences d'intérêt modernes
    target_venues = {"acl", "naacl", "eacl", "conll", "emnlp", "coling", "lrec", "findings"}
    # Codes historiques (ex: Pxx = ACL, Dxx = EMNLP/NAACL, Nxx = NAACL, Cxx = COLING, Lxx = LREC, Wxx = workshops)
    venue_codes = {"P", "D", "N", "C", "L", "W"}

    # Mots-clés de détection
    keywords = [
        "classification", "classifier", "benchmark", "dataset", "data set",
        "corpus", "sentiment", "polarity", "evaluation", "multi-label",
        "binary", "multiclass", "multilabel"
    ]
    
    # --- Mots-clés pour la détection ---
    domain_keywords = {
        "sentiment": r"sentiment|opinion|polarity|affect|emotion|mood|feeling",
        "emotion": r"emotion|affective|empathy|feeling",
        "topic": r"topic modeling|lda|subject|theme",
        "hate_speech": r"hate speech|offensive|abusive|toxic",
        "medical": r"medical|biomedical|clinical|health|patient|doctor",
        "education": r"education|student|learning|pedagog",
        "translation": r"translation|translat|mt|machine translation",
        "dialogue": r"dialogue|conversation|chatbot|utterance",
    }

    task_keywords = {
        "classification": r"classification|classifier|categorization",
        "generation": r"text generation|summarization|captioning|data-to-text|gpt|llm|mistral",
        "benchmark": r"benchmark|evaluation|shared task|leaderboard",
        "clustering": r"clustering|unsupervised|grouping",
        "sequence_labeling": r"sequence labeling|ner|named entity|pos tagging|sequence tag",
    }
    
    # À compiler avec: flags = re.IGNORECASE | re.DOTALL
    model_keywords = {
        # === Modèles classiques ===
        "svm": r"\bSVM\b|support\s+vector",
        "naive_bayes": r"naive[- ]?bayes",
        "logistic_regression": r"logistic\s+regression|régression\s+logistique",

        # === Réseaux de neurones ===
        "cnn": r"\bCNN\b|convolution(?:al)?\s+neural\s+network|réseau(?:x)?\s+convolutionnel",
        "rnn": r"\bRNN\b(?![a-z])|recurrent\s+neural\s+network|réseau(?:x)?\s+récurrent",
        "lstm": r"\bLSTM\b|long\s+short[- ]?term\s+memory",

        # === Transformers & LLMs ===
        # Transformer (éviter les transformateurs électriques)
        "transformer": (
            r"\btransformer\b"
            r"(?=.*\b(self[- ]?attention|encoder[- ]?decoder|multi[- ]?head|attention)\b)"
            r"(?!.*\b(power|electric|voltage|substation|distribution)\b)"
        ),

        # BERT et variantes
        "bert": r"\bBERT\b|roberta|xlm[- ]?roberta|albert|deberta|distilbert|camembert",

        # GPT uniquement (avec contexte NLP et exclusions sémantiques)
        # - Contexte requis: transformer|language model|nlp|openai|llm|text|prompt|chat
        # - Exclusions: usages historiques d'autres domaines (enzymes, Pareto, plasma, etc.)
        "gpt": (
            r"(?=.*\b(transformer|language\s+model|nlp|openai|llm|text|prompt|chat|few[- ]?shot)\b)"
            r"(?!.*\b(glutamate|pyruvate|transaminase|enzyme|liver|pareto|plasma|thruster|projectile|geology)\b)"
            r"\b(?:chat)?gpt(?:[- ]?(?:2|3(?:\.5)?|4(?:\.1|o|[- ]?turbo)?|5|j|neo(?:x)?))?\b"
        ),

        # Autres LLM (séparés de GPT pour éviter la confusion)
        "llama": r"\bllama(?:[- ]?\d+)?\b|meta\s+llama",
        "mistral": r"\bmistral\b",
        "falcon": r"\bfalcon\b(?=.*\bllm|model|transformer\b)",
        "bloom": r"\bbloom\b(?=.*\bllm|model|transformer\b)",
        "vicuna": r"\bvicuna\b",
        "gemma": r"\bgemma\b",
        "qwen": r"\bqwen\b",
        "phi": r"\bphi[- ]?\d*\b(?=.*\b(microsoft|llm|model)\b)",
        "opt": r"\bOPT\b(?=.*\bmeta|facebook|llm|model\b)",
        "gpt_neox": r"\bgpt[- ]?neo(?:x)?\b",
        "gpt_j": r"\bgpt[- ]?j\b",

        # === Modèles probabilistes ===
        "crf": r"\bCRF\b|conditional\s+random\s+field",
        "hmm": r"\bHMM\b|hidden\s+markov",

        # === Spécialisés / embeddings / graphes ===
        "word2vec": r"\bword2vec\b|skip[- ]?gram|cbow",
        "gcn": r"\bGCN\b|graph\s+convolutional\s+network|\bGNN\b|graph\s+neural\s+network",

        # === Basé sur règles ===
        "rule_based": r"rule[- ]?based|pattern\s+matching|heuristic|regex|règle[- ]?basée",

        # === Fourre-tout ===
        "other": r"",
    }
    
    pattern = re.compile("|".join(keywords), re.IGNORECASE)

    stats = defaultdict(int)
    stats_years = defaultdict(int)
    details = []

    count = 0
    for pid, paper in tqdm(iter_papers(anthology), desc="Analyse des papiers ACL", unit="papier"):
        # --- Filtrage sur la conférence (modernes ou codes ACL historiques) ---
        venues = set(getattr(paper, "venue_ids", []))
        venue_ok = False
        for v in venues:
            v_lower = v.lower()
            if v_lower in target_venues:
                venue_ok = True
                break
            if v and v[0].upper() in venue_codes:
                venue_ok = True
                break
        if not venue_ok:
            continue

        # --- Extraction du texte brut (MarkupText → str) ---
        # --- Extraction des métadonnées ---
        info = extract_paper_info(paper)

        # --- Extraction du texte brut (MarkupText → str) ---
        title = safe_text(getattr(paper, "title", ""))
        abstract = safe_text(getattr(paper, "abstract", ""))
        # if not abstract and info.get("pdf_url"):
        #     abstract = fetch_abstract_from_web(info["pdf_url"])
        title_lc = title.lower()
        abstract_lc = abstract.lower()

        # --- Détection des mots-clés ---
        if not pattern.search(title_lc + " " + abstract_lc):
            continue
        year_str = str(info.get("year", "")).strip()
        if year_str:
            stats_years[year_str] += 1

        # --- Détection des domaines et des tâches ---
        text = (title_lc + " " + abstract_lc)

        detected_domain = "other"
        for dom, regex in domain_keywords.items():
            if re.search(regex, text):
                detected_domain = dom
                break

        detected_task = "unspecified"
        for task, regex in task_keywords.items():
            if re.search(regex, text):
                detected_task = task
                break
            
        detected_model = "other"
        for model, regex in model_keywords.items():
            if re.search(regex, text, re.IGNORECASE):
                detected_model = model
                break

        details.append({
            "paper_id": pid,
            "title": info["title"],
            "year": info["year"],
            "venue": info["venue"],
            "address": info["address"],
            "authors": info["authors"],
            "abstract": abstract,
            "task_type": detected_task,
            "domain": detected_domain,
            "model_family": detected_model,
            "pdf_url": info["pdf_url"],
        })

        stats["total_papers"] += 1
        stats[f"type_{detected_task}"] += 1
        stats[f"domain_{detected_domain}"] += 1

        count += 1
        if limit and count >= limit:
            break

    # --- Affichage résumé ---
    print("\n=== CARTOGRAPHIE CLASSIFICATION ===")
    print(f"Nombre total d'articles trouvés : {stats['total_papers']}")
    print("Répartition par type de tâche : "
          f"binaire={stats['type_binary']}, multi-classe={stats['type_multiclass']}, "
          f"multi-label={stats['type_multilabel']}, non-spécifié={stats['type_unspecified']}")
    print("Répartition par domaine : "
          f"sentiment={stats['domain_sentiment']}, autres={stats['domain_other']}")

    print("\nExemples :")
    for d in details[:10]:
        print(f"- {d['year']} | {d['venue']} | {d['title']} ({d['task_type']}, {d['domain']})")

    # --- Comptage par année (trié) ---
    def _year_key(y: str):
        return (0, int(y)) if y.isdigit() else (1, y)

    print("\nComptage par année :")
    for y, c in sorted(stats_years.items(), key=lambda kv: _year_key(kv[0])):
        print(f"- {y}: {c}")

    return {"stats": stats, "details": details, "per_year": dict(stats_years)}


def affichage_tendance(resultats: dict) -> None:
    """
    Affiche un graphique de l'évolution du nombre de papiers par année.
    Prend en entrée le dictionnaire retourné par cartographie_classification().
    """
    per_year = resultats.get("per_year", {})
    if not per_year:
        print("⚠️ Aucun comptage par année trouvé dans les résultats.")
        return

    years = sorted(per_year.keys())
    counts = [per_year[y] for y in years]

    plt.figure(figsize=(9, 5))
    plt.plot(years, counts, marker="o", linewidth=2)
    plt.title("Évolution du nombre de papiers liés à la classification", fontsize=13)
    plt.xlabel("Année")
    plt.ylabel("Nombre de papiers")
    plt.grid(True, linestyle="--", alpha=0.6)
    plt.xticks(rotation=45)
    plt.tight_layout()
    plt.show()

# --- Export/affichage générique ----------------------------------------------

def main() -> None:
    parser = argparse.ArgumentParser(
        description="Parcourir l'ACL Anthology et afficher/exporter des métadonnées."
    )
    parser.add_argument(
        "--to-csv",
        metavar="FICHIER",
        help="Chemin d'export CSV (facultatif). Si non fourni, imprime en texte lisible.",
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=0,
        help="Limiter le nombre d'articles affichés/exportés (0 = pas de limite).",
    )
    args = parser.parse_args()

    # Charger la base locale (chemin ABSOLU recommandé)
    anthology = Anthology.from_repo(
        "/Users/gabrielferreira/Documents/Udem/IFT6285/ProjetSession1/acl-anthology"
    )

    rows = []
    for pid, paper in iter_papers(anthology):
        info = extract_paper_info(paper)
        rows.append({"paper_id": pid, **info})
        if args.limit and len(rows) >= args.limit:
            break

    if args.to_csv:
        with open(args.to_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.DictWriter(
                f,
                fieldnames=["paper_id", "title", "year", "authors", "venue", "address", "abstract", "pdf_url", "doi"],
            )
            writer.writeheader()
            writer.writerows(rows)
        print(f"✅ Exporté {len(rows)} lignes vers {args.to_csv}")
    else:
        # Affichage lisible
        for r in rows:
            print(
                f"[{r['paper_id']}] {r['title']} ({r['year']})\n"
                f"  Auteurs: {r['authors']}\n"
                f"  Venue : {r['venue']}\n"
                f"  Adresse : {r['address']}\n"
                f"  Abstract : { (r.get('abstract') or '')[:200] }...\n"
                f"  PDF   : {r['pdf_url']}\n"
                f"  DOI   : {r['doi']}\n"
            )
        print(f"Total affiché: {len(rows)}")


if __name__ == "__main__":
    # Option A : listage générique
    # main()

    # Option B : cartographie ciblée + affichage du comptage par année
    anthology = Anthology.from_repo(
        "/Users/gabrielferreira/Documents/Udem/IFT6285/ProjetSession1/acl-anthology"
    )
    resultats = cartographie_classification(anthology)

    # --- Sauvegarde JSON ---
    json_path = "resultats_classification_enrichie2.json"
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(resultats, f, ensure_ascii=False, indent=2)
    print(f"\n💾 Fichier JSON enregistré : {json_path}")

    # --- Affichage graphique ---
    affichage_tendance(resultats)