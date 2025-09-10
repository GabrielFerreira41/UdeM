import time
from datasets import load_dataset
import re
import spacy
import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

nlp = spacy.load("fr_core_news_sm")

ds = "BioMedTok/Wikipedia"
ds = load_dataset(ds)
ds_train = ds['train']
#print(ds_train[0]['text'][:500])

def split_text_spacy(texts):
    tokens = []
    for text in texts:
        doc = nlp(text)  # tokenisation seule
        # Conserver tous les tokens (mots + ponctuation), exclure uniquement les espaces
        tokens.extend([tok.text for tok in doc if not tok.is_space])
    return tokens
    
def count(text):
    dict_rec = {}
    #création dico récurence
    for mot in text:
        if mot not in dict_rec.keys():
            dict_rec[mot] = 1
        else:
            dict_rec[mot]+=1
    
    for cle, valeur in sorted(dict_rec.items(), key=lambda item: item[1], reverse=True)[:20]:
        print(cle, ":", valeur)
    return dict_rec

def vocab_growth(tokens):
    """Retourne (xs, ys) où xs est l'indice du token lu (1..N) et ys le nombre de mots distincts vus."""
    seen = set()
    xs, ys = [], []
    for i, tok in enumerate(tokens, 1):
        if tok not in seen:
            seen.add(tok)
        xs.append(i)
        ys.append(len(seen))
    return xs, ys

def plot_vocab_growth(tokens, title=None):
    """Trace la courbe types (mots distincts) en fonction des tokens lus."""
    xs, ys = vocab_growth(tokens)
    fig, ax = plt.subplots()
    ax.step(xs, ys, where='post')  # tracé discret (escaliers)
    ax.set_xlabel("Nombre de tokens lus")
    ax.set_ylabel("Nombre de mots distincts (taille du dictionnaire)")
    if title is None:
        title = "Évolution du vocabulaire (spaCy, tokenisation brute : mots et ponctuation)"
    ax.set_title(title)
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
text_pre = split_text_spacy(textes)
counter = count(text_pre)
end = time.time()
label = "spacy-raw"
print(f"# {label} examples: {nb_exemples} tokens: {len(text_pre)} types: {len(counter)} time: {end - start:.2f} (s)")

# Affichage de la courbe via une fonction dédiée (optionnel)
plot_vocab_growth(text_pre)
