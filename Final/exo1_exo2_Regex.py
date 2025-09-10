import time
from datasets import load_dataset
import re
from collections import Counter
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker
import unicodedata

# Choisir le mode: "base" | "digits" | "social"
MODE = "base2"

TOKEN_RE = re.compile(r"[A-Za-z_]+|\d+|<[^>\s]+>|[^\w\s]", re.UNICODE)

ds = "BioMedTok/Wikipedia"
ds = load_dataset(ds)
ds_train = ds['train']
#print(ds_train[0]['text'][:500])

def split_text(texts):
    tokens = []
    for text in texts:
        text = unicodedata.normalize('NFC', text)
        # Modes optionnels en fonction de MODE
        if MODE in ("base1", "base2"):
            text = text.lower()
            text = re.sub(r"\d", "@", text)
        if MODE == "base2":
            text = re.sub(r"https?://\S+", "<URL>", text)
            text = re.sub(r"\b\S+@\S+\.\S+\b", "<EMAIL>", text)
            text = re.sub(r"@\w+", "<USER>", text)
            text = re.sub(r"#\w+", "<HASHTAG>", text)

        # Espaces propres
        text = re.sub(r"\s+", " ", text).strip()
        tokens.extend(re.findall(r"\w+|[^\w\s]", text))
    #print(tokens)
    return tokens
    
def count(tokens):
    counter = Counter()
    counter.update(tokens)
    total_tokens = sum(counter.values())
    return counter, total_tokens


# Helper function: évolution du nombre de mots distincts au fil de la lecture
def vocab_growth(tokens):
    """Retourne (xs, ys) où xs est l'indice du token lu (1..N) et ys le nombre de mots distincts vus.
    """
    seen = set()
    xs, ys = [], []
    for i, tok in enumerate(tokens, 1):
        if tok not in seen:
            seen.add(tok)
        xs.append(i)
        ys.append(len(seen))
    return xs, ys

def display_outputs(tokens):
    

    # Courbe: évolution du nombre de mots distincts au fil de la lecture (1 token à la fois)
    xs, ys = vocab_growth(tokens)
    fig, ax = plt.subplots()
    ax.step(xs, ys, where='post')  # tracé discret (escaliers)
    ax.set_xlabel("Nombre de tokens lus")
    ax.set_ylabel("Nombre de mots distincts (taille du dictionnaire)")
    ax.set_title("Évolution du vocabulaire au fil de la lecture")
    # graduations entières et format sans décimales
    ax.xaxis.set_major_locator(mticker.MaxNLocator(integer=True))
    ax.xaxis.set_major_formatter(mticker.StrMethodFormatter('{x:,.0f}'))
    ax.yaxis.set_major_locator(mticker.MaxNLocator(integer=True))
    ax.yaxis.set_major_formatter(mticker.StrMethodFormatter('{x:,.0f}'))
    ax.grid(True, alpha=0.3)
    fig.tight_layout()
    plt.show()

    
nb_exemples = 1000
start = time.time()
textes = [ds_train[i]['text'] for i in range(nb_exemples)]
text_pre = split_text(textes)
label_map = {"base": "lower-punct", "base1": "lower-punct-digit", "base2": "lower-punct-digit-web"}
label = label_map.get(MODE, "lower-punct")
end = time.time()
counter, total_tokens = count(text_pre)
for tok, freq in counter.most_common(20):
    print(f"{tok} : {freq}")

print(f"# {label} examples: {nb_exemples} tokens: {len(text_pre)} types: {len(counter)} time: {end - start:.2f} (s)")



# Affichage optionnel (peut être désactivé en mettant RUN_DISPLAY = False)
RUN_DISPLAY = True
if RUN_DISPLAY:
    display_outputs(text_pre)