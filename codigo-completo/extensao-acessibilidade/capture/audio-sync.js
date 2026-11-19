/* AVA 0.6 — áudio atrasado em Web Audio, somente na página controlada de laboratório.
 * O áudio original é silenciado até que a rota source -> DelayNode -> GainNode ->
 * destination esteja pronta; jamais conectar o áudio direto e atrasado em paralelo.
 * createMediaElementSource() é chamado uma única vez para cada <video>.
 */
(() => {
  const A = globalThis.AVA ||= {};
  class AudioSyncController {
    constructor(video, onStatus = () => {}) {
      this.video = video;
      this.onStatus = onStatus;
      this.context = null;
      this.source = null;
      this.delay = null;
      this.gain = null;
      this.enabled = false;
      this.delayMs = 400;
      this.volume = 0.65;
    }
    static clamp(n, lo, hi) {
      const v = Number(n);
      return Number.isFinite(v) ? Math.max(lo, Math.min(hi, v)) : lo;
    }
    get information() {
      return {
        enabled: this.enabled,
        delayMs: this.delayMs,
        state: this.context?.state || 'não iniciado',
        volume: this.volume
      };
    }
    connectRoute() {
      if (!this.context || !this.source) return;
      this.source.disconnect();
      this.delay?.disconnect();
      this.gain?.disconnect();
      const delay = this.context.createDelay(2);
      delay.delayTime.setValueAtTime(this.delayMs / 1000, this.context.currentTime);
      const gain = this.context.createGain();
      gain.gain.setValueAtTime(this.volume, this.context.currentTime);
      this.source.connect(delay);
      delay.connect(gain);
      gain.connect(this.context.destination);
      this.delay = delay;
      this.gain = gain;
    }
    async enable(delayMs = 400, volume = 0.65) {
      this.delayMs = AudioSyncController.clamp(delayMs, 200, 1000);
      this.volume = AudioSyncController.clamp(volume, 0, 1);
      // Impede áudio sem atraso durante a preparação da rota.
      this.video.muted = true;
      try {
        if (!this.context) {
          const AudioConstructor = window.AudioContext || window.webkitAudioContext;
          if (!AudioConstructor) throw new Error('Web Audio API indisponível neste navegador.');
          this.context = new AudioConstructor({ latencyHint: 'interactive' });
          this.source = this.context.createMediaElementSource(this.video);
        }
        this.connectRoute();
        await this.context.resume();
        if (this.context.state !== 'running') throw new Error('Áudio não autorizado. Clique novamente para ativar.');
        this.video.volume = 1;
        this.video.muted = false;
        this.enabled = true;
        this.onStatus(`Áudio atrasado ${this.delayMs} ms, volume ${Math.round(this.volume * 100)}%.`);
        return true;
      } catch (error) {
        this.disable();
        this.onStatus('Não foi possível iniciar o áudio: ' + error.message);
        throw error;
      }
    }
    disable() {
      this.video.muted = true;
      this.enabled = false;
      try { this.source?.disconnect(); } catch (_) {}
      try { this.delay?.disconnect(); } catch (_) {}
      try { this.gain?.disconnect(); } catch (_) {}
      this.delay = null;
      this.gain = null;
      // Não fechar o AudioContext: não se pode associar o mesmo elemento
      // a outro MediaElementAudioSourceNode posteriormente.
      this.context?.suspend().catch(() => {});
      this.onStatus('Áudio desativado.');
    }
    setVolume(percent) {
      this.volume = AudioSyncController.clamp(percent, 0, 1);
      if (this.gain && this.context) {
        this.gain.gain.setTargetAtTime(this.volume, this.context.currentTime, 0.015);
      }
    }
    setDelay(delayMs) {
      const value = AudioSyncController.clamp(delayMs, 200, 1000);
      if (value === this.delayMs) return;
      this.delayMs = value;
      if (this.enabled) this.flush();
      this.onStatus(`Atraso do áudio atualizado: ${value} ms.`);
    }
    flush() {
      // Busca/reinício: descarta o som antigo que ainda esteja na linha de atraso.
      if (!this.enabled) return;
      this.video.muted = true;
      try {
        this.connectRoute();
        this.video.muted = false;
      } catch (error) {
        this.disable();
        this.onStatus('Erro ao reiniciar sincronização: ' + error.message);
      }
    }
  }
  A.audioSync = { AudioSyncController };
})();
