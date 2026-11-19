/* Regra proporcional/linear declarada no TCC; parâmetros são experimentais. */
(() => {
  const A = globalThis.AVA ||= {};
  function decide({ flash, pattern }, profile) {
    const mode = profile.smoothingMode || 'adaptive';
    const signal = Math.max(flash?.score || 0, pattern?.score || 0);
    const threshold = 0.65 - (Number(profile.sensitivity ?? 60) / 100) * 0.55;
    const intensity = A.settings.clamp((signal - threshold) / (1 - threshold));
    const temporal = A.settings.clamp(Number(profile.temporalStrength ?? 65) / 100);
    const spatial = A.settings.clamp(Number(profile.spatialStrength ?? 35) / 100);
    if (mode === 'off') return { signal, intensity, alpha: 1, spatial: 0, mode };
    if (mode === 'fixed') return {
      signal, intensity, alpha: 1 - 0.80 * temporal,
      spatial: 0.65 * spatial, mode
    };
    return {
      signal, intensity,
      alpha: 1 - 0.80 * temporal * intensity,
      spatial: spatial * (pattern?.score || 0) * intensity,
      mode
    };
  }
  A.adaptive = { decide };
})();
