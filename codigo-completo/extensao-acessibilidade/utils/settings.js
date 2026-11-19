/* Configurações compartilhadas entre popup e scripts da página. */
(() => {
  const AVA = globalThis.AVA ||= {};
  const STORAGE_KEY = 'avaStateV3'; // Preserva os três perfis da versão 0.3.
  const defaultProfile = Object.freeze({
    brightness: 100, contrast: 100,
    pauseAnimations: false, hideGifs: false, pauseLoopVideos: false,
    automaticAnalysis: false, smoothingMode: 'adaptive', sensitivity: 60,
    temporalStrength: 65, spatialStrength: 35, bufferDelayMs: 400, qualityMode: 'balanced'
  });
  const initialState = () => ({
    activation: { mode: 'off', host: null }, activeProfile: '1',
    profiles: Object.fromEntries(['1', '2', '3'].map(id => [id, { ...defaultProfile }]))
  });
  const clamp = (value, min = 0, max = 1) =>
    Math.max(min, Math.min(max, Number.isFinite(Number(value)) ? Number(value) : min));
  function normalizeState(raw) {
    const state = initialState();
    if (!raw || typeof raw !== 'object') return state;
    const mode = ['off', 'site', 'all'].includes(raw.activation?.mode)
      ? raw.activation.mode : 'off';
    state.activation = { mode, host: mode === 'site' && typeof raw.activation?.host === 'string'
      ? raw.activation.host : null };
    state.activeProfile = ['1', '2', '3'].includes(raw.activeProfile)
      ? raw.activeProfile : '1';
    for (const id of ['1', '2', '3']) {
      const p = raw.profiles?.[id] || {};
      state.profiles[id] = {
        ...defaultProfile, ...p,
        brightness: clamp(p.brightness ?? 100, 70, 110),
        contrast: clamp(p.contrast ?? 100, 70, 110),
        sensitivity: clamp(p.sensitivity ?? 60, 0, 100),
        temporalStrength: clamp(p.temporalStrength ?? 65, 0, 100),
        spatialStrength: clamp(p.spatialStrength ?? 35, 0, 100),
        bufferDelayMs: clamp(p.bufferDelayMs ?? 400, 200, 1000),
        qualityMode: ['performance', 'balanced', 'quality', 'original'].includes(p.qualityMode) ? p.qualityMode : 'balanced',
        smoothingMode: ['off', 'fixed', 'adaptive'].includes(p.smoothingMode)
          ? p.smoothingMode : 'adaptive'
      };
    }
    return state;
  }
  function enabledHere(state, hostname) {
    return state?.activation?.mode === 'all' ||
      (state?.activation?.mode === 'site' && state.activation.host === hostname);
  }
  AVA.settings = { STORAGE_KEY, defaultProfile, initialState, normalizeState, enabledHere, clamp };
})();
