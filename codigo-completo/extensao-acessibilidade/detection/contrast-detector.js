/* Contraste de Michelson e repetitividade de listras horizontais/verticais. */
(() => {
  const A = globalThis.AVA ||= {};
  const michelson = (high, low) => high + low > 0 ? (high - low) / (high + low) : 0;
  function transitions(values, threshold = 0.10) {
    let count = 0, lastSign = 0, reversals = 0;
    for (let i = 1; i < values.length; i++) {
      const diff = values[i] - values[i - 1];
      if (Math.abs(diff) < threshold) continue;
      const sign = Math.sign(diff);
      count++;
      if (lastSign && lastSign !== sign) reversals++;
      lastSign = sign;
    }
    return { count, reversals };
  }
  function analyze(stats) {
    const { map, width, height, min, max } = stats;
    const contrast = michelson(max, min);
    // Várias linhas e colunas evitam depender de apenas um corte.
    const lines = [];
    for (const f of [0.2, 0.4, 0.6, 0.8]) {
      const y = Math.min(height - 1, Math.floor(height * f));
      const x = Math.min(width - 1, Math.floor(width * f));
      const row = [], col = [];
      const strideX = Math.max(1, Math.floor(width / 90));
      const strideY = Math.max(1, Math.floor(height / 90));
      for (let px = 0; px < width; px += strideX) row.push(map[y * width + px]);
      for (let py = 0; py < height; py += strideY) col.push(map[py * width + x]);
      lines.push(transitions(row), transitions(col));
    }
    const repeating = lines.filter(l => l.count >= 5 && l.reversals >= 4).length;
    const repetitions = repeating / lines.length;
    const score = contrast < 0.35 ? 0 :
      Math.min(1, repetitions * Math.min(1, (contrast - 0.35) / 0.55));
    return { michelson: contrast, repetition: repetitions, score,
      pattern: score >= 0.38 };
  }
  A.contrast = { michelson, transitions, analyze };
})();
