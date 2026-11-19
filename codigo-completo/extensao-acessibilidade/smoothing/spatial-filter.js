/* Gaussiano 3x3 separável: mesmo kernel [1,2,1] x [1,2,1], menos acessos por pixel. */
(() => {
  const A = globalThis.AVA ||= {};
  function gaussian3x3(frame, strength = 0) {
    strength = A.settings.clamp(strength);
    if (strength === 0) return frame;
    const { width: w, height: h, data: src } = frame;
    const out = new Uint8ClampedArray(src);
    const horizontal = new Float32Array(w * h * 3);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const l = (y * w + Math.max(0, x - 1)) * 4;
        const c = (y * w + x) * 4;
        const r = (y * w + Math.min(w - 1, x + 1)) * 4;
        const hbase = (y * w + x) * 3;
        for (let ch = 0; ch < 3; ch++) {
          horizontal[hbase + ch] = (src[l + ch] + 2 * src[c + ch] + src[r + ch]) / 4;
        }
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const top = (Math.max(0, y - 1) * w + x) * 3;
        const mid = (y * w + x) * 3;
        const bottom = (Math.min(h - 1, y + 1) * w + x) * 3;
        const idx = (y * w + x) * 4;
        for (let ch = 0; ch < 3; ch++) {
          const blurred = (horizontal[top + ch] + 2 * horizontal[mid + ch] + horizontal[bottom + ch]) / 4;
          out[idx + ch] = (1 - strength) * src[idx + ch] + strength * blurred;
        }
      }
    }
    return { width: w, height: h, data: out };
  }
  A.spatial = { gaussian3x3 };
})();
