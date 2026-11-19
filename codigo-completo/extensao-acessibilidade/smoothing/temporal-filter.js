/* EMA temporal por canal. O histórico é reiniciado quando a geometria muda. */
(() => {
  const A = globalThis.AVA ||= {};
  class TemporalFilter {
    constructor() { this.previous = null; }
    reset() { this.previous = null; }
    apply(imageData, alpha) {
      alpha = A.settings.clamp(alpha, 0.01, 1);
      const source = imageData.data;
      const output = new Uint8ClampedArray(source.length);
      if (!this.previous || this.previous.length !== source.length) {
        output.set(source);
      } else {
        for (let i = 0; i < source.length; i += 4) {
          output[i] = alpha * source[i] + (1 - alpha) * this.previous[i];
          output[i + 1] = alpha * source[i + 1] + (1 - alpha) * this.previous[i + 1];
          output[i + 2] = alpha * source[i + 2] + (1 - alpha) * this.previous[i + 2];
          output[i + 3] = source[i + 3];
        }
      }
      this.previous = output.slice();
      return { width: imageData.width, height: imageData.height, data: output };
    }
  }
  A.temporal = { TemporalFilter };
})();
