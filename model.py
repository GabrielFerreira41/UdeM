import tensorflow as tf
tf.keras.backend.clear_session()

from tensorflow.keras.models import Sequential
from tensorflow.keras.layers import Embedding, LSTM, Dense
from tensorflow.keras.preprocessing.text import Tokenizer
from tensorflow.keras.preprocessing.sequence import pad_sequences
import numpy as np
import tensorflowjs as tfjs
import shutil
import os
import zipfile

# Données simples
texts = [
    "crée une playlist de rap",
    "joue une chanson",
    "mets une playlist jazz",
    "je veux écouter du rock"
]
labels = [0, 1, 0, 1]

# Prétraitement
tokenizer = Tokenizer()
tokenizer.fit_on_texts(texts)
seqs = tokenizer.texts_to_sequences(texts)
X = pad_sequences(seqs, maxlen=10, padding='post')
y = np.array(labels)

# Modèle
model = Sequential()
model.add(tf.keras.Input(shape=(10,)))
model.add(Embedding(input_dim=len(tokenizer.word_index)+1, output_dim=16))
model.add(LSTM(32))
model.add(Dense(2, activation='softmax'))
model.compile(optimizer='adam', loss='sparse_categorical_crossentropy', metrics=['accuracy'])
model.fit(X, y, epochs=10)

# Export vers TensorFlow.js
export_path = "tfjs_model"
if os.path.exists(export_path):
    shutil.rmtree(export_path)
tfjs.converters.save_keras_model(model, export_path)

# Optionnel : création d'un ZIP pour transport
with zipfile.ZipFile("tfjs_model.zip", 'w') as zipf:
    for root, _, files in os.walk(export_path):
        for file in files:
            full_path = os.path.join(root, file)
            arcname = os.path.relpath(full_path, export_path)
            zipf.write(full_path, arcname)

print("✅ Modèle exporté et compressé dans tfjs_model.zip")