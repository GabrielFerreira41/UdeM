import pandas as pd
import seaborn as sns
import matplotlib.pyplot as plt
from scipy.ndimage import gaussian_filter1d
import os
import re, os

# === 1. Fonction pour lisser une série temporelle ===
def smooth_series(values, sigma=1):
    """
    Applique un lissage gaussien à une série numérique.
    Utile pour adoucir les courbes d'évolution annuelle.
    """
    return gaussian_filter1d(values, sigma=sigma)


# === 2. Fonction pour tracer et enregistrer l'évolution annuelle ===
def plot_evolution_annee(df, output_dir="figures", smooth=True):
    """
    Affiche et sauvegarde la courbe du nombre d'articles par année.
    - df : DataFrame contenant au moins la colonne 'year'
    - output_dir : dossier où sauvegarder les figures
    - smooth : si True, applique un lissage
    """
    os.makedirs(output_dir, exist_ok=True)
    df["year"] = df["year"].astype(int)
    yearly = df["year"].value_counts().sort_index()
    y = smooth_series(yearly.values, sigma=1.2) if smooth else yearly.values

    plt.figure(figsize=(10,5))
    sns.lineplot(x=yearly.index, y=y, linewidth=2.5, color="royalblue")
    plt.title("Évolution du nombre d’articles par année", fontsize=14)
    plt.xlabel("Année")
    plt.ylabel("Nombre d’articles")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "evolution_par_annee2.png"), dpi=300)
    plt.close()


# === 3. Répartition par type de tâche ===
def plot_taches(df, output_dir="figures"):
    """
    Crée un graphique en barres pour la répartition des types de tâche.
    """
    os.makedirs(output_dir, exist_ok=True)
    plt.figure(figsize=(6,4))
    order = df["task_type"].value_counts().index.tolist()
    sns.countplot(y="task_type", hue="task_type", data=df, order=order, palette="crest", legend=False)
    plt.title("Répartition des types de tâche")
    plt.xlabel("Nombre d’articles")
    plt.ylabel("Type de tâche")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "repartition_taches2.png"), dpi=300)
    plt.close()


# === 4. Répartition des domaines ===
def plot_domaines(df, output_dir="figures"):
    """
    Graphique circulaire ou barres horizontales pour les domaines.
    """
    os.makedirs(output_dir, exist_ok=True)
    counts = df["domain"].value_counts()
    plt.figure(figsize=(5,5))
    plt.pie(counts, labels=counts.index, autopct="%1.1f%%", startangle=90, colors=sns.color_palette("pastel"))
    plt.title("Domaines dominants")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "repartition_domaines2.png"), dpi=300)
    plt.close()


# === 5. Évolution par thème ou modèle (si ajouté dans le JSON étendu) ===
def plot_tendance_theme(df, column, output_dir="figures", smooth=False):
    """
    Trace l’évolution par année d’une colonne catégorielle (ex: 'theme', 'model_family').
    """
    os.makedirs(output_dir, exist_ok=True)
    df["year"] = df["year"].astype(int)
    grouped = df.groupby(["year", column]).size().reset_index(name="count")

    plt.figure(figsize=(10,6))
    sns.lineplot(data=grouped, x="year", y="count", hue=column, linewidth=2)
    plt.title(f"Évolution par {column}")
    plt.xlabel("Année")
    plt.ylabel("Nombre d’articles")
    plt.legend(title=column, bbox_to_anchor=(1.05, 1), loc='upper left')
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, f"evolution_{column}.png"), dpi=300)
    plt.close()

# === 6. Répartition par tranches mixtes (5 ans puis annuel dès 2020) ===
def plot_repartition_temps(df, output_dir="figures", yearly_from: int = 2015):
    """
    Affiche un diagramme en barres groupées par période :
    - Avant `yearly_from` (ex.: 2020), périodes de 5 ans (ex.: 1995–1999, 2000–2004, ...)
    - À partir de `yearly_from`, périodes annuelles ("2020", "2021", ...)
    Barres colorées par `task_type`.
    """
    import numpy as np

    os.makedirs(output_dir, exist_ok=True)

    # Nettoyage des années
    df = df[df["year"].astype(str).str.isnumeric()].copy()
    df["year"] = df["year"].astype(int)

    if df.empty:
        return

    min_year = int(df["year"].min())
    max_year = int(df["year"].max())

    # Point de départ arrondi au multiple de 5 inférieur
    base = min_year - (min_year % 5)

    # Construire l'ordre des périodes (catégories) : 5 ans jusqu'à yearly_from-1, puis annuel
    pre_periods = [f"{y}-{y+4}" for y in range(base, min(yearly_from, 9999), 5) if y+4 < yearly_from]
    post_periods = [str(y) for y in range(max(yearly_from, min_year), max_year + 1)]
    periods_order = pre_periods + post_periods

    # Mapping year -> period label
    def year_to_period(y: int) -> str:
        if y < yearly_from:
            bucket_start = y - (y % 5)
            bucket_end = bucket_start + 4
            return f"{bucket_start}-{bucket_end}"
        else:
            return str(y)

    df["periode"] = df["year"].apply(year_to_period)

    # S'assurer que l'ordre est respecté
    df["periode"] = pd.Categorical(df["periode"], categories=periods_order, ordered=True)

    # Grouper par période et type de tâche
    grouped = df.groupby(["periode", "task_type"]).size().reset_index(name="count")

    plt.figure(figsize=(14, 6))
    ax = sns.barplot(
        data=grouped,
        x="periode",
        y="count",
        hue="task_type",
        palette="crest"
    )
    handles, labels = ax.get_legend_handles_labels()

    plt.title(f"Répartition des articles (5 ans jusqu'en {yearly_from-1}, annuel dès {yearly_from})")
    plt.xlabel("Période")
    plt.ylabel("Nombre d’articles")
    plt.xticks(rotation=45, ha="right")
    ax.legend(handles, labels, title="Type de tâche", loc="upper left", bbox_to_anchor=(0.01, 0.99), frameon=True, borderaxespad=0.5)
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, "repartition_temps_mixte.png"), dpi=300)
    plt.close()

# === 7. Évolution des familles de modèles par année ===

def plot_evolution_model_family(df, output_dir="figures", normalize: bool = False, smooth: bool = False, sigma: float = 1.0, exclude_families=None, yscale: str | None = None):
    """
    Trace l'évolution annuelle des familles de modèles présentes dans la colonne `model_family`.
    - normalize=False : affiche des comptes bruts.
    - normalize=True  : affiche des pourcentages (somme=100% par année).
    - smooth=True     : applique un lissage gaussien (sigma configurable).
    - exclude_families : liste des familles à exclure du graphique (ex: ['other'])
    - yscale : type d'échelle y ("log", "symlog", ou None)
    """
    os.makedirs(output_dir, exist_ok=True)

    # Garder uniquement les années numériques et les familles non vides
    df = df[df["year"].astype(str).str.isnumeric()].copy()
    if "model_family" not in df.columns:
        raise ValueError("La colonne 'model_family' est absente du DataFrame. Assure-toi d'avoir enrichi le JSON.")

    df["year"] = df["year"].astype(int)
    df["model_family"] = df["model_family"].fillna("other")

    # Comptage par (year, model_family)
    grouped = df.groupby(["year", "model_family"]).size().reset_index(name="count")
    pivot = grouped.pivot(index="year", columns="model_family", values="count").fillna(0).sort_index()

    # Normalisation en % par année si demandé
    if normalize:
        row_sums = pivot.sum(axis=1)
        row_sums[row_sums == 0] = 1  # éviter division par zéro
        pivot = pivot.div(row_sums, axis=0) * 100.0

    # Lissage optionnel
    if smooth and len(pivot) > 3:
        for col in pivot.columns:
            pivot[col] = smooth_series(pivot[col].values, sigma=sigma)

    # Mise en forme pour seaborn
    plot_df = pivot.reset_index().melt(id_vars="year", var_name="model_family", value_name="value")

    # Exclure certaines familles (ex.: 'other') si demandé
    if exclude_families:
        plot_df = plot_df[~plot_df["model_family"].isin(exclude_families)]

    plt.figure(figsize=(12, 6))
    ax = sns.lineplot(data=plot_df, x="year", y="value", hue="model_family", linewidth=2)

    if yscale == "log":
        ax.set_yscale("log")
    elif yscale == "symlog":
        ax.set_yscale("symlog", linthresh=10)

    titre = "Évolution des familles de modèles (" + ("%" if normalize else "compte") + ")"
    plt.title(titre)
    plt.xlabel("Année")
    plt.ylabel("Pourcentage" if normalize else "Nombre d’articles")
    plt.legend(title="Famille de modèle", bbox_to_anchor=(1.02, 1), loc='upper left')
    plt.tight_layout()

    fname = "evolution_model_family_pct.png" if normalize else "evolution_model_family.png"
    plt.savefig(os.path.join(output_dir, fname), dpi=300)
    plt.close()




# === 8.c. Histogramme: nombre de papiers par venue ===

def plot_histogram_venue(
    df,
    output_dir: str = "figures",
    explode_multi: bool = True,
    normalize_case: bool = True,
    top_n: int | None = None,
    min_count: int = 1,
    fname: str = "histogram_venue.png",
):
    """
    Affiche et enregistre un histogramme (barres horizontales) du nombre de papiers par venue.

    Paramètres
    ----------
    df : pd.DataFrame
        Doit contenir la colonne 'venue'.
    output_dir : str
        Dossier où sauvegarder la figure.
    explode_multi : bool
        Si True, sépare les venues multiples (ex.: "iwpt, ws").
    normalize_case : bool
        Si True, normalise la casse (minuscule) et trim les espaces.
    top_n : int | None
        Si défini, n'affiche que les Top N venues.
    min_count : int
        Filtre les venues avec un nombre minimal d'articles (>= min_count).
    fname : str
        Nom de fichier de sortie pour la figure.

    Retour
    -----
    pd.DataFrame
        Tableau des comptes utilisés pour l'affichage, triés décroissants.
    """
    os.makedirs(output_dir, exist_ok=True)

    if "venue" not in df.columns:
        raise ValueError("La colonne 'venue' est absente du DataFrame.")

    tmp = df[["venue"]].copy()
    tmp["venue"] = tmp["venue"].fillna("unknown").astype(str)

    if explode_multi:
        tmp["venue"] = tmp["venue"].str.split(r"\s*,\s*")
        tmp = tmp.explode("venue", ignore_index=True)

    if normalize_case:
        tmp["venue"] = tmp["venue"].str.strip().str.lower()
        tmp.loc[tmp["venue"].eq("") | tmp["venue"].eq("none"), "venue"] = "unknown"

    counts = (
        tmp["venue"].value_counts()
        .rename_axis("venue")
        .reset_index(name="count")
        .sort_values("count", ascending=False)
    )

    # Filtrages
    if min_count > 1:
        counts = counts[counts["count"] >= min_count]
    if top_n is not None and top_n > 0:
        counts = counts.head(top_n)

    # Plot barres horizontales (plus lisible pour des labels longs)
    plt.figure(figsize=(12, max(4, 0.4 * len(counts))))
    ax = sns.barplot(data=counts, y="venue", x="count", palette="crest")
    ax.set_title("Nombre de papiers par venue en lien avec de la classification")
    ax.set_xlabel("Nombre de papiers")
    ax.set_ylabel("Venue")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, fname), dpi=300)
    plt.close()

    return counts

# === 8.d. Histogramme: nombre de papiers par pays ===

def _infer_country_from_text(text: str) -> str | None:
    """
    Heuristique légère pour extraire un pays depuis une chaîne d'adresse.
    - Cherche d'abord des alias fréquents (USA, UK, Korea...).
    - Puis matche une liste de pays communs (sans dépendance externe).
    Retourne le nom du pays en Anglais en cas de match, sinon None.
    """
    if not isinstance(text, str):
        return None
    t = text.lower()

    # alias d'abord
    aliases = {
        "u.s.": "United States", "usa": "United States", "us": "United States",
        "united states": "United States", "u.s.a": "United States",
        "u.k.": "United Kingdom", "uk": "United Kingdom", "england": "United Kingdom", "scotland": "United Kingdom",
        "korea, republic of": "South Korea", "south korea": "South Korea", "korea": "South Korea",
        "czech republic": "Czech Republic", "viet nam": "Vietnam",
        "peoples republic of china": "China", "p.r. china": "China",
    }
    for k, v in aliases.items():
        if k in t:
            return v

    countries = [
    "Afghanistan", "Albania", "Algeria", "Andorra", "Angola", "Argentina", "Armenia", "Australia", "Austria",
    "Azerbaijan", "Bahamas", "Bahrain", "Bangladesh", "Barbados", "Belarus", "Belgium", "Belize", "Benin",
    "Bhutan", "Bolivia", "Bosnia and Herzegovina", "Botswana", "Brazil", "Brunei", "Bulgaria", "Burkina Faso",
    "Burundi", "Cambodia", "Cameroon", "Canada", "Chile", "China", "Colombia", "Congo", "Costa Rica",
    "Croatia", "Cuba", "Cyprus", "Czech Republic", "Denmark", "Dominican Republic", "Ecuador", "Egypt",
    "El Salvador", "Estonia", "Ethiopia", "Finland", "France", "Georgia", "Germany", "Ghana", "Greece",
    "Guatemala", "Honduras", "Hong Kong", "Hungary", "Iceland", "India", "Indonesia", "Iran", "Iraq",
    "Ireland", "Israel", "Italy", "Jamaica", "Japan", "Jordan", "Kazakhstan", "Kenya", "Kuwait", "Laos",
    "Latvia", "Lebanon", "Libya", "Lithuania", "Luxembourg", "Malaysia", "Malta", "Mexico", "Moldova",
    "Monaco", "Mongolia", "Morocco", "Myanmar", "Namibia", "Nepal", "Netherlands", "New Zealand", "Nigeria",
    "Norway", "Oman", "Pakistan", "Palestine", "Panama", "Paraguay", "Peru", "Philippines", "Poland",
    "Portugal", "Qatar", "Romania", "Russia", "Saudi Arabia", "Senegal", "Serbia", "Singapore", "Slovakia",
    "Slovenia", "South Africa", "South Korea", "Spain", "Sri Lanka", "Sweden", "Switzerland", "Syria",
    "Taiwan", "Tanzania", "Thailand", "Tunisia", "Turkey", "Uganda", "Ukraine", "United Arab Emirates",
    "United Kingdom", "United States", "Uruguay", "Uzbekistan", "Venezuela", "Vietnam", "Zambia", "Zimbabwe"
    ]
    for c in countries:
        if c.lower() in t:
            return c
    return None


def plot_histogram_country(
    df,
    output_dir: str = "figures",
    top_n: int | None = 20,
    min_count: int = 1,
    source_col: str = "country",
    fallback_from_address: bool = True,
    fname: str = "histogram_country.png",
):
    """
    Affiche et enregistre un histogramme du nombre de papiers par pays.
    - Si la colonne `country` n'existe pas, et que `fallback_from_address=True`,
      essaie de l'inférer depuis la colonne `address`.
    - Sauvegarde aussi un CSV `repartition_country.csv`.
    """
    os.makedirs(output_dir, exist_ok=True)

    data = df.copy()

    # Préparer la colonne 'country'
    if source_col in data.columns:
        country_series = data[source_col].astype(str)
    elif fallback_from_address and "address" in data.columns:
        country_series = data["address"].apply(_infer_country_from_text)
    else:
        raise ValueError("Aucune colonne 'country' ni 'address' disponible pour déterminer le pays.")

    # Normalisation légère
    country_series = country_series.fillna("").str.strip()
    country_series = country_series.replace({"": None, "none": None, "nan": None})

    # Comptes
    counts = (
        country_series.dropna()
        .value_counts()
        .rename_axis("country")
        .reset_index(name="count")
        .sort_values("count", ascending=False)
    )

    if min_count > 1:
        counts = counts[counts["count"] >= min_count]
    if top_n is not None and top_n > 0:
        counts = counts.head(top_n)

    # Plot
    plt.figure(figsize=(12, max(4, 0.45 * len(counts))))
    ax = sns.barplot(data=counts, y="country", x="count", palette="crest")
    ax.set_title("Nombre d’articles par pays en lien avec de la classification")
    ax.set_xlabel("Nombre d’articles")
    ax.set_ylabel("Pays")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, fname), dpi=300)
    plt.close()

    # Sauvegarde CSV
    counts.to_csv(os.path.join(output_dir, "repartition_country.csv"), index=False)

    return counts



# Improved regex patterns for better detection
# === Multi-label ===
RE_MULTI_LABEL = re.compile(
    r"\b(multi[-\s]?(label(ed)?|tag(ging)?|output(s)?|target(s)?))\b", re.I
)

# === Binary (2 classes) ===
RE_BINARY = re.compile(
    r"\b("
    r"binary|two[-\s]?class|2[-\s]?class|dual[-\s]?class|bi[-\s]?class"
    r"|yes\s*/\s*no|positive\s*/\s*negative|true\s*/\s*false"
    r"|pairwise\s+classification"
    r")\b", re.I
)

# === Multi-class ===
RE_MULTICLASS = re.compile(
    r"\b("
    r"multi[-\s]?(class|category|categor(ies|y)|task|problem)"
    r"|n[-\s]?(class|way|category)"
    r"|\b\d{1,3}[-\s]?(class|way|category|categories)\b"
    r"|\b(classification\s+into\s+\d+\s+(classes|categories))"
    r")\b", re.I
)

# === K-classes (nombre explicite) ===
RE_K_CLASSES = re.compile(
    r"\b(\d{1,3})\s*(?:class(?:es)?|categor(?:y|ies))\b", re.I
)
def infer_label_type(title: str, abstract: str = "") -> str:
    """
    Infers the label type from the title and optionally abstract.
    Returns one of: "binary", "multiclass", "multi_label", "unspecified".
    """
    t = f"{title or ''} {abstract or ''}".lower()
    # Multi-label detection
    if RE_MULTI_LABEL.search(t):
        return "multi_label"
    # Binary classification detection
    if RE_BINARY.search(t):
        return "binary"
    # Multi-class detection
    if RE_MULTICLASS.search(t):
        return "multiclass"
    m = RE_K_CLASSES.search(t)
    if m and m.group(1).isdigit() and int(m.group(1)) >= 3:
        return "multiclass"
    return "unspecified"

def plot_classification_types(df, output_dir="figures", fname="hist_classif_types.png"):
    os.makedirs(output_dir, exist_ok=True)
    tmp = df.copy()
    # Use both title and abstract if abstract is present
    if "abstract" in tmp.columns:
        tmp["label_type"] = tmp.apply(lambda row: infer_label_type(row["title"], row.get("abstract", "")), axis=1)
    else:
        tmp["label_type"] = tmp["title"].apply(lambda t: infer_label_type(t))
    # option : ne garder que les papiers de classification
    tmp = tmp[tmp["task_type"].str.lower().eq("classification")]
    counts = (tmp["label_type"].value_counts()
              .rename_axis("type")
              .reset_index(name="count")
              .sort_values("count", ascending=False))
    plt.figure(figsize=(7, 4 + 0.3*len(counts)))
    plt.barh(counts["type"], counts["count"])
    plt.gca().invert_yaxis()
    plt.title("Types de classification (binaire / multi-classe / multi-label)")
    plt.xlabel("Nombre d’articles")
    plt.tight_layout()
    plt.savefig(os.path.join(output_dir, fname), dpi=300)
    plt.close()
    return counts

import json
with open("resultats_classification_enrichie2.json") as f:
    resultats = json.load(f)

df = pd.DataFrame(resultats["details"])

# plot_evolution_annee(df)
# plot_taches(df)
# plot_domaines(df)
#plot_repartition_temps(df)
# plot_evolution_model_family(df, normalize=False, smooth=True, sigma=1.2, exclude_families=["other"], yscale="symlog")
# plot_evolution_model_family(df, normalize=True, smooth=True, sigma=1.2, exclude_families=["other"], yscale=None)
#plot_histogram_venue(df, top_n=20)  # histogramme des 30 venues les plus fréquentes
#plot_histogram_country(df, top_n=20)  # histogramme des pays
plot_classification_types(df)
