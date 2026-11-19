/* Luminância relativa WCAG: RGB sRGB -> valores lineares -> Y. */
(() => {
  const A = globalThis.AVA ||= {};
  const linearize = (v) => {
    const c = Math.max(0, Math.min(255, v)) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const relative = (r, g, b) => 0.2126 * linearize(r) + 0.7152 * linearize(g) + 0.0722 * linearize(b);
  function analyze(imageData, gridX = 8, gridY = 6) {
    const { width, height, data } = imageData;
    if (!width || !height || !data || data.length < width * height * 4) {
      throw new Error('Dados de imagem inválidos.');
    }
    const tiles = new Float64Array(gridX * gridY);
    const redTiles = new Float64Array(gridX * gridY);
    const counts = new Uint32Array(gridX * gridY);
    const map = new Float32Array(width * height);
    let sum = 0, min = 1, max = 0;
    for (let y = 0; y < height; y++) {
      const row = y * width;
      const gy = Math.min(gridY - 1, Math.floor(y * gridY / height));
      for (let x = 0; x < width; x++) {
        const p = row + x, i = p * 4;
        const a = data[i + 3] / 255;
        // Imagem transparente é composta sobre branco para a análise.
        const r = data[i] * a + 255 * (1 - a);
        const g = data[i + 1] * a + 255 * (1 - a);
        const b = data[i + 2] * a + 255 * (1 - a);
        const L = relative(r, g, b);
        map[p] = L;
        sum += L; min = Math.min(min, L); max = Math.max(max, L);
        const tile = gy * gridX + Math.min(gridX - 1, Math.floor(x * gridX / width));
        tiles[tile] += L;
        // Indicador cromático preliminar, NÃO substitui o limiar WCAG de flash vermelho.
        redTiles[tile] += Math.max(0, (r - Math.max(g, b)) / 255);
        counts[tile]++;
      }
    }
    const means = Array.from(tiles, (v, i) => v / Math.max(1, counts[i]));
    const redness = Array.from(redTiles, (v, i) => v / Math.max(1, counts[i]));
    return { width, height, mean: sum / (width * height), min, max,
      tileMeans: means, tileRedness: redness, map, gridX, gridY };
  }
  A.luminance = { linearize, relative, analyze };
})();
