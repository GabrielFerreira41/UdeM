import * as tf from '@tensorflow/tfjs';
console.log("✅ TensorFlow.js chargé :", tf);
let model;

export const loadModel = async () => {
  if (!model) {
    model = await tf.loadLayersModel('/model/model.json');
    console.log('Model loaded!');
  }
  return model;
};

export const predictIntent = async (text, tokenizer) => {
  const model = await loadModel();
  const input = tokenizer(text);
  const inputTensor = tf.tensor2d([input], [1, 10], 'int32');
  const prediction = model.predict(inputTensor);
  const intentIndex = prediction.argMax(-1).dataSync()[0];
  return intentIndex;
};