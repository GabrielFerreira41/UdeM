import time
from datasets import load_dataset
import re
from collections import Counter
from transformers import AutoTokenizer

import matplotlib.pyplot as plt
import matplotlib.ticker as mticker

TOKEN_RE = re.compile(r"\w+|[^\w\s]", re.UNICODE)

ds = "BioMedTok/Wikipedia"
ds = load_dataset(ds)
ds_train = ds['train']

tokenizer = AutoTokenizer.from_pretrained("bert-base-multilingual-cased")

def split_text(texts):
    # Subword tokenization with mBERT (no lowercasing; model is cased)
    # Batch encode for speed, no special tokens to mirror raw subword counts
    enc = tokenizer.batch_encode_plus(
        texts,
        add_special_tokens=False,
        return_attention_mask=False,
        return_token_type_ids=False
    )
    tokens = []
    for ids in enc["input_ids"]:
        tokens.extend(tokenizer.convert_ids_to_tokens(ids))
    return tokens
    
def count(tokens):
    counter = Counter()
    counter.update(tokens)
    total_tokens = sum(counter.values())
    return counter, total_tokens


# Helper function: evolution of unique tokens as tokens are read one-by-one
def vocab_growth(tokens):
    """Retourne (xs, ys) où xs est l'indice du token lu (1..N) et ys le nombre de tokens distincts vus.
    """
    seen = set()
    xs, ys = [], []
    for i, tok in enumerate(tokens, 1):
        if tok not in seen:
            seen.add(tok)
        xs.append(i)
        ys.append(len(seen))
    return xs, ys

# Display/plotting/summary function
def display_outputs(tokens):

    # Courbe: évolution du nombre de tokens distincts au fil de la lecture (1 par 1)
    xs, ys = vocab_growth(tokens)
    fig, ax = plt.subplots()
    ax.step(xs, ys, where='post')
    ax.set_xlabel("Nombre de tokens lus")
    ax.set_ylabel("Nombre de tokens distincts")
    ax.set_title("Évolution du vocabulaire (subwords mBERT)")
    # Ticks entiers et format sans décimales
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
end = time.time()
counter, total_tokens = count(text_pre)
for tok, freq in counter.most_common(20):
    print(f"{tok} : {freq}")
print(f"# subword-mbert examples: {nb_exemples} tokens: {total_tokens} types: {len(counter)} time: {end - start:.2f} (s)")

display_outputs(text_pre)