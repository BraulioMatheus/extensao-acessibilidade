/* Detector de mudanças opostas em blocos. Indicador experimental, não validador WCAG. */
(() => {
  const A = globalThis.AVA ||= {};
  class FlashDetector {
    constructor(options = {}) {
      this.threshold = options.threshold ?? 0.12;
      this.minArea = options.minArea ?? 0.08;
      this.reset();
    }
    reset() {
      this.previous = null;
      this.previousRed = null;
      this.pending = [];
      this.events = [];
      this.lastTime = -Infinity;
    }
    push(stats, timeMs) {
      if (!Number.isFinite(timeMs)) timeMs = 0;
      if (timeMs < this.lastTime) this.reset();
      this.lastTime = timeMs;
      const now = stats.tileMeans;
      if (!this.previous || this.previous.length !== now.length) {
        this.previous = now.slice();
        this.previousRed = (stats.tileRedness || []).slice();
        this.pending = new Array(now.length).fill(null);
        return { events: 0, rate: 0, score: 0, affectedArea: 0, redChange: false };
      }
      let active = 0, matches = 0, maxDelta = 0, redChange = false;
      const n = now.length;
      for (let i = 0; i < n; i++) {
        const delta = now[i] - this.previous[i];
        if (Math.abs(delta) < this.threshold) continue;
        active++;
        maxDelta = Math.max(maxDelta, Math.abs(delta));
        const sign = Math.sign(delta);
        const old = this.pending[i];
        if (old && sign !== old.sign && timeMs - old.time <= 1000) {
          matches++;
          this.pending[i] = null;
        } else {
          this.pending[i] = { sign, time: timeMs };
        }
        if (Math.abs((stats.tileRedness || [])[i] - (this.previousRed || [])[i]) > 0.30) {
          redChange = true;
        }
      }
      const affectedArea = active / n;
      const event = matches / n >= this.minArea;
      if (event) this.events.push(timeMs);
      this.events = this.events.filter(t => t >= timeMs - 1000);
      this.previous = now.slice();
      this.previousRed = (stats.tileRedness || []).slice();
      const score = Math.min(1, Math.max(
        event ? 0.6 : 0,
        (maxDelta / 0.65) * Math.min(1, affectedArea * 2),
        this.events.length / 3
      ));
      return { events: event ? 1 : 0, rate: this.events.length, score,
        affectedArea, redChange };
    }
  }
  A.flash = { FlashDetector };
})();
