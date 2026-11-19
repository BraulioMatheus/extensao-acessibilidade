/* Amostra quadros de vídeo acessível. Não é um decodificador e não garante pré-exibição. */
(() => {
  const A = globalThis.AVA ||= {};
  class VideoSampler {
    constructor(video, onFrame, onError) {
      this.video = video; this.onFrame = onFrame; this.onError = onError;
      this.running = false; this.handle = null; this.raf = null;
      this.width = 160; this.height = 90; this.lastSampleTime = -Infinity;
      const pair = A.imageReader.createCanvas(this.width, this.height);
      this.canvas = pair.canvas; this.context = pair.context;
    }
    start() {
      if (this.running) return;
      this.running = true;
      const next = (timestamp, metadata) => {
        if (!this.running) return;
        try {
          // Em vídeos ocultos de laboratório, rAF permite ler quadros mesmo
          // quando requestVideoFrameCallback não é acionado pelo compositor.
          if (timestamp - this.lastSampleTime < 65) {
            this.schedule(next);
            return;
          }
          this.lastSampleTime = timestamp;
          if (this.video.readyState >= 2) {
            this.context.drawImage(this.video, 0, 0, this.width, this.height);
            const data = this.context.getImageData(0, 0, this.width, this.height);
            this.onFrame(data, metadata?.mediaTime != null ? metadata.mediaTime * 1000 : timestamp);
          }
        } catch (err) { this.stop(); this.onError?.(err); return; }
        this.schedule(next);
      };
      this.schedule(next);
    }
    schedule(fn) {
      if (!this.running) return;
      const isHidden = !this.video.getClientRects().length;
      if (!isHidden && this.video.requestVideoFrameCallback) {
        this.handle = this.video.requestVideoFrameCallback(fn);
      } else {
        this.raf = requestAnimationFrame(fn);
      }
    }
    stop() {
      this.running = false;
      if (this.handle != null && this.video.cancelVideoFrameCallback) {
        this.video.cancelVideoFrameCallback(this.handle);
      }
      if (this.raf != null) cancelAnimationFrame(this.raf);
      this.handle = null; this.raf = null;
    }
  }
  A.videoReader = { VideoSampler };
})();
