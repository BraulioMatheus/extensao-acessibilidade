/* AVA 0.7 — análise em miniatura, apresentação de quadros completos em Canvas.
 * A fila guarda ImageBitmap (cópia do quadro decodificado). O bitmap só aparece
 * na prévia após o atraso. O áudio é atrasado separadamente via Web Audio.
 * Não garante captura de todos os frames nem proteção fotossensível.
 */
(() => {
  const A = globalThis.AVA ||= {};

  const QUALITY_LIMITS = Object.freeze({
    performance: [426, 240], balanced: [854, 480],
    quality: [1280, 720], original: [1920, 1080]
  });

  function limitForMode(mode) { return QUALITY_LIMITS[mode] || QUALITY_LIMITS.balanced; }
  function estimateBytes(frame) {
    return frame?.data?.byteLength || (frame?.width && frame?.height ? frame.width * frame.height * 4 : 0);
  }
  function disposeFrame(frame) { try { frame?.close?.(); } catch (_) {} }

  class FrameQueue {
    constructor({ delayMs = 400, maxFrames = 65, maxBytes = 96 * 1024 * 1024 } = {}) {
      this.delayMs = Math.max(0, Number(delayMs) || 0);
      this.maxFrames = Math.max(1, Math.floor(maxFrames));
      this.maxBytes = Math.max(4, Math.floor(maxBytes));
      this.items = []; this.bytes = 0; this.dropped = 0;
    }
    push(entry) {
      const size = estimateBytes(entry.frame);
      if (size <= 0 || size > this.maxBytes || !Number.isFinite(entry.capturedAt)) {
        this.dropped++; disposeFrame(entry.frame); return false;
      }
      entry.byteSize = size;
      this.items.push(entry); this.bytes += size;
      while (this.items.length > this.maxFrames || this.bytes > this.maxBytes) this.discardFirst();
      return true;
    }
    discardFirst() {
      const item = this.items.shift();
      if (item) { this.bytes -= item.byteSize; this.dropped++; disposeFrame(item.frame); }
    }
    takeReady(now, maxOverdueMs = Infinity) {
      let latest = null, skipped = 0;
      while (this.items.length && now - this.items[0].capturedAt >= this.delayMs) {
        const item = this.items.shift(); this.bytes -= item.byteSize;
        if (latest) { disposeFrame(latest.frame); skipped++; }
        latest = item;
      }
      this.dropped += skipped;
      if (latest && now - latest.capturedAt - this.delayMs > maxOverdueMs) {
        disposeFrame(latest.frame); this.dropped++;
        return { entry: null, skipped: skipped + 1 };
      }
      return { entry: latest, skipped };
    }
    clear() { for (const item of this.items) disposeFrame(item.frame); this.items.length = 0; this.bytes = 0; }
    get length() { return this.items.length; }
  }

  // Indicador de movimento: alteração localizada que não se explica por mudança
  // uniforme da luminância média. Evita confundir oscilações globais com movimento.
  function motionIndex(previous, current, prevMean, mean) {
    if (!previous || previous.length !== current.length) return 0;
    let abs = 0, count = 0;
    for (let i = 0; i < current.length; i += 12) {
      abs += Math.abs(current[i] - previous[i]); count++;
    }
    const localChange = abs / Math.max(1, count);
    const globalChange = Math.abs(mean - prevMean);
    return A.settings.clamp((localChange - globalChange) * 10);
  }
  function compensateMotion(alpha, motion, flashScore, mode) {
    if (mode !== 'adaptive' || motion <= 0 || flashScore >= 0.4) return alpha;
    const protection = Math.min(1, motion * 2.5);
    return Math.max(alpha, alpha + (0.94 - alpha) * protection);
  }

  class BufferedVideoSession {
    constructor(video, getProfile, { onReport, onError, onStatus } = {}) {
      this.video = video; this.getProfile = getProfile;
      this.onReport = onReport; this.onError = onError; this.onStatus = onStatus;
      this.running = false; this.callbackId = null; this.rafId = null;
      this.lastCaptureAt = -Infinity; this.lastDisplayAt = null;
      this.lastMediaTime = -Infinity; this.framesCaptured = 0; this.framesDisplayed = 0;
      this.previousOriginalMean = null; this.previousEstimatedMean = null;
      this.previousMap = null; this.flashes = new A.flash.FlashDetector();
      const p = getProfile();
      this.delayMs = A.settings.clamp(p.bufferDelayMs ?? 400, 200, 1000);
      this.qualityMode = p.qualityMode || 'balanced';
      this.queue = new FrameQueue({ delayMs: this.delayMs, maxFrames: 65, maxBytes: 160 * 1024 * 1024 });
      this.output = document.createElement('canvas');
      this.output.className = 'ava-v5-preview';
      this.output.width = 2; this.output.height = 2;
      this.output.setAttribute('role', 'img');
      this.output.setAttribute('aria-label', 'Prévia de vídeo analisado com buffer');
      this.output.title = 'Exibição em resolução superior, após análise e buffer';
      this.outputContext = this.output.getContext('2d', { alpha: false });
      this.historyCanvas = document.createElement('canvas');
      this.historyContext = this.historyCanvas.getContext('2d', { alpha: false });
      this.historyReady = false;
      this.captureCanvas = null; this.captureContext = null;
      this.snapshotCanvas = null; this.snapshotContext = null;
      this.ready = false; this.mediaErrorReported = false; this.epoch = 0;
      this.onSeek = () => this.reset();
      this.onMeta = () => this.configure();
      this.onEnded = () => this.onStatus?.('Vídeo encerrado. Esvaziando buffer...');
      this.onVideoError = () => this.fail(new Error('Não foi possível decodificar o vídeo.'));
    }
    publishDelay() {
      this.video.dataset.avaBufferDelayMs = String(this.delayMs);
      this.video.dispatchEvent(new CustomEvent('ava:buffer-config', { detail: String(this.delayMs) }));
    }
    configure() {
      if (!this.running || !this.video.videoWidth || !this.outputContext) return;
      const p = this.getProfile();
      this.qualityMode = p.qualityMode || 'balanced';
      const limits = limitForMode(this.qualityMode);
      const display = A.imageReader.dimensions(this.video.videoWidth, this.video.videoHeight, ...limits);
      const sample = A.imageReader.dimensions(this.video.videoWidth, this.video.videoHeight, 256, 144);
      this.output.width = display.width; this.output.height = display.height;
      this.historyCanvas.width = display.width; this.historyCanvas.height = display.height;
      const pair = A.imageReader.createCanvas(sample.width, sample.height);
      this.captureCanvas = pair.canvas; this.captureContext = pair.context;
      this.snapshotCanvas = typeof OffscreenCanvas !== 'undefined'
        ? new OffscreenCanvas(display.width, display.height)
        : document.createElement('canvas');
      this.snapshotCanvas.width = display.width;
      this.snapshotCanvas.height = display.height;
      this.snapshotContext = this.snapshotCanvas.getContext('2d', { alpha: false });
      if (!this.snapshotContext) throw new Error('Não foi possível criar Canvas de captura.');
      this.ready = true; this.reset(); this.publishDelay();
      this.onStatus?.(`Análise ${sample.width}×${sample.height}; exibição ${display.width}×${display.height}; buffer ${this.delayMs} ms; modo ${this.qualityMode}.`);
    }
    updateProfile() {
      const p = this.getProfile();
      const delay = A.settings.clamp(p.bufferDelayMs ?? 400, 200, 1000);
      const quality = p.qualityMode || 'balanced';
      if (quality !== this.qualityMode) {
        this.qualityMode = quality;
        this.configure(); // Limpa fila e histórico ao trocar dimensões.
        return;
      }
      if (delay !== this.delayMs) {
        this.delayMs = delay; this.queue.delayMs = delay;
        this.reset(); this.publishDelay();
        this.onStatus?.(`Novo atraso ${delay} ms. Fila reiniciada.`);
      }
    }
    start() {
      if (this.running) return;
      this.running = true;
      this.video.addEventListener('loadedmetadata', this.onMeta);
      this.video.addEventListener('seeked', this.onSeek);
      this.video.addEventListener('ended', this.onEnded);
      this.video.addEventListener('error', this.onVideoError);
      this.video.insertAdjacentElement('afterend', this.output);
      if (this.video.readyState >= 1) this.configure();
      if (typeof this.video.requestVideoFrameCallback === 'function') this.requestFrame();
      else this.onStatus?.('Modo de captura alternativo (sem requestVideoFrameCallback).');
      this.animationTick();
    }
    reset() {
      this.epoch++;
      this.queue.clear(); this.flashes.reset(); this.historyReady = false;
      this.previousOriginalMean = null; this.previousEstimatedMean = null;
      this.previousMap = null; this.lastMediaTime = -Infinity;
      this.lastCaptureAt = -Infinity; this.lastDisplayAt = null;
      this.outputContext?.clearRect(0, 0, this.output.width, this.output.height);
      this.historyContext?.clearRect(0, 0, this.historyCanvas.width, this.historyCanvas.height);
    }
    requestFrame() {
      if (!this.running || typeof this.video.requestVideoFrameCallback !== 'function') return;
      this.callbackId = this.video.requestVideoFrameCallback((now, metadata) => {
        this.callbackId = null;
        if (!this.running) return;
        if (!this.video.paused && !this.video.seeking)
          this.capture(metadata?.mediaTime != null ? metadata.mediaTime * 1000 : this.video.currentTime * 1000, now);
        this.requestFrame();
      });
    }
    snapshot() {
      this.snapshotContext.drawImage(this.video, 0, 0, this.output.width, this.output.height);
      if (typeof this.snapshotCanvas.transferToImageBitmap === 'function') {
        return this.snapshotCanvas.transferToImageBitmap();
      }
      return createImageBitmap(this.snapshotCanvas);
    }
    capture(mediaTimeMs, frameArrivalAt = performance.now()) {
      if (!this.ready || this.video.readyState < 2 || this.video.seeking) return;
      if (Number.isFinite(mediaTimeMs) && mediaTimeMs <= this.lastMediaTime + 0.5) return;
      try {
        const begin = performance.now();
        this.captureContext.drawImage(this.video, 0, 0, this.captureCanvas.width, this.captureCanvas.height);
        const source = this.captureContext.getImageData(0, 0, this.captureCanvas.width, this.captureCanvas.height);
        const stats = A.luminance.analyze(source);
        const flash = this.flashes.push(stats, mediaTimeMs);
        const pattern = A.contrast.analyze(stats);
        const selected = A.adaptive.decide({ flash, pattern }, this.getProfile());
        const motion = motionIndex(this.previousMap, stats.map, this.previousOriginalMean ?? stats.mean, stats.mean);
        const alpha = compensateMotion(selected.alpha, motion, flash.score, selected.mode);
        // Estimativa feita a partir da média reduzida. NÃO equivale a medir
        // pixels da saída final (que inclui composição e possível blur).
        const estimatedMean = this.previousEstimatedMean === null ? stats.mean
          : alpha * stats.mean + (1 - alpha) * this.previousEstimatedMean;
        const originalDelta = this.previousOriginalMean === null ? null
          : Math.abs(stats.mean - this.previousOriginalMean);
        const estimatedDelta = this.previousEstimatedMean === null ? null
          : Math.abs(estimatedMean - this.previousEstimatedMean);
        this.previousMap = stats.map;
        this.previousOriginalMean = stats.mean;
        this.previousEstimatedMean = estimatedMean;
        this.lastCaptureAt = performance.now();
        this.lastMediaTime = mediaTimeMs;
        this.framesCaptured++;
        const epoch = this.epoch;
        const report = {
          sourceTimeMs: Math.round(mediaTimeMs),
          averageLuminance: Number(stats.mean.toFixed(5)),
          flashScore: Number(flash.score.toFixed(4)),
          flashesLastSecond: flash.rate, patternScore: Number(pattern.score.toFixed(4)),
          rawAlpha: Number(selected.alpha.toFixed(4)),
          alpha: Number(alpha.toFixed(4)),
          motionScore: Number(motion.toFixed(4)),
          smoothingMode: selected.mode,
          originalDeltaLuminance: originalDelta === null ? null : Number(originalDelta.toFixed(5)),
          processedDeltaLuminance: null, deltaReductionPct: null,
          estimatedProcessedDeltaLuminance: estimatedDelta === null ? null : Number(estimatedDelta.toFixed(5)),
          processingMs: null,
          bufferTargetMs: this.delayMs, framesCaptured: this.framesCaptured,
          analysisWidth: stats.width, analysisHeight: stats.height,
          frameWidth: this.output.width, frameHeight: this.output.height,
          qualityMode: this.qualityMode,
          frameBytes: this.output.width * this.output.height * 4
        };
        const finish = bitmap => {
          if (!this.running || !this.ready || epoch !== this.epoch || mediaTimeMs < this.lastMediaTime - 1500) {
            disposeFrame(bitmap); return;
          }
          report.processingMs = Number((performance.now() - begin).toFixed(2));
          this.queue.push({ capturedAt: frameArrivalAt, frame: bitmap, report,
            alpha, spatial: selected.spatial });
        };
        const frame = this.snapshot();
        if (frame && typeof frame.then === 'function') {
          frame.then(finish).catch(err => this.fail(err));
        } else finish(frame);
      } catch (error) { this.fail(error); }
    }
    present(entry) {
      const context = this.outputContext;
      const frame = entry.frame;
      // Only adaptive/fixed modes can blend frames; no-filter presents exact bitmap.
      const alpha = entry.report.smoothingMode === 'off' || !this.historyReady
        ? 1 : entry.alpha;
      const blur = entry.report.smoothingMode !== 'off' && entry.spatial > 0.02
        ? Math.min(0.65, entry.spatial * 1.1) : 0;
      context.save();
      context.globalAlpha = 1;
      context.globalCompositeOperation = 'source-over';
      context.filter = 'none';
      if (alpha < 0.999 && this.historyReady) {
        context.drawImage(this.historyCanvas, 0, 0);
        context.globalAlpha = alpha;
      } else {
        context.clearRect(0, 0, this.output.width, this.output.height);
      }
      if (blur) context.filter = `blur(${blur.toFixed(3)}px)`;
      context.drawImage(frame, 0, 0, this.output.width, this.output.height);
      context.restore();
      if (entry.report.smoothingMode !== 'off') {
        this.historyContext.drawImage(this.output, 0, 0);
        this.historyReady = true;
      } else {
        this.historyReady = false;
      }
    }
    animationTick() {
      if (!this.running) return;
      const now = performance.now();
      const missingCallback = typeof this.video.requestVideoFrameCallback !== 'function';
      if (!this.video.paused && (missingCallback || now - this.lastCaptureAt >= 250))
        this.capture(this.video.currentTime * 1000, now);
      const ready = this.queue.takeReady(now, 180);
      if (ready.entry) {
        const entry = ready.entry;
        try {
          this.present(entry);
          this.framesDisplayed++;
          const interval = this.lastDisplayAt === null ? null : now - this.lastDisplayAt;
          this.lastDisplayAt = now;
          this.onReport?.({
            ...entry.report,
            actualBufferMs: Number((now - entry.capturedAt).toFixed(1)),
            schedulingLatenessMs: Number(Math.max(0, now - entry.capturedAt - this.delayMs).toFixed(1)),
            displayIntervalMs: interval === null ? null : Number(interval.toFixed(1)),
            queuedFrames: this.queue.length, droppedFrames: this.queue.dropped,
            framesDisplayed: this.framesDisplayed
          });
        } catch (error) { this.fail(error); return; }
        finally { disposeFrame(entry.frame); }
      }
      this.rafId = requestAnimationFrame(() => this.animationTick());
    }
    fail(error) {
      if (this.mediaErrorReported) return;
      this.mediaErrorReported = true;
      this.onError?.(error); this.stop();
    }
    stop() {
      this.running = false;
      if (this.callbackId != null && typeof this.video.cancelVideoFrameCallback === 'function')
        this.video.cancelVideoFrameCallback(this.callbackId);
      if (this.rafId != null) cancelAnimationFrame(this.rafId);
      this.video.removeEventListener('loadedmetadata', this.onMeta);
      this.video.removeEventListener('seeked', this.onSeek);
      this.video.removeEventListener('ended', this.onEnded);
      this.video.removeEventListener('error', this.onVideoError);
      this.callbackId = null; this.rafId = null;
      this.queue.clear(); this.output.remove();
      delete this.video.dataset.avaBufferDelayMs;
      this.video.dispatchEvent(new CustomEvent('ava:buffer-detached'));
    }
  }
  A.frameBuffer = { FrameQueue, BufferedVideoSession, limitForMode, motionIndex, compensateMotion };
})();
