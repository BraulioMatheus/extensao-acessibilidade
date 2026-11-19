/* Métricas básicas para a análise experimental. */
(() => {
  const A = globalThis.AVA ||= {};
  function classification(truth, predicted) {
    if (truth.length !== predicted.length) throw new Error('Tamanhos diferentes.');
    let tp = 0, fp = 0, fn = 0, tn = 0;
    truth.forEach((t, i) => {
      if (t && predicted[i]) tp++;
      else if (!t && predicted[i]) fp++;
      else if (t && !predicted[i]) fn++;
      else tn++;
    });
    const precision = tp + fp ? tp / (tp + fp) : 0;
    const recall = tp + fn ? tp / (tp + fn) : 0;
    return { tp, fp, fn, tn, precision, recall,
      f1: precision + recall ? 2 * precision * recall / (precision + recall) : 0 };
  }
  function meanAbsoluteError(original, processed) {
    if (original.length !== processed.length) throw new Error('Tamanhos diferentes.');
    if (!original.length) return 0;
    let sum = 0;
    for (let i = 0; i < original.length; i++) sum += Math.abs(original[i] - processed[i]);
    return sum / original.length;
  }
  A.metrics = { classification, meanAbsoluteError };
})();
