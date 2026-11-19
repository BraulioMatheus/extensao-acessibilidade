/* Características de animações DOM. Não inspeciona movimento dentro de GIF/vídeo. */
(() => {
  const A = globalThis.AVA ||= {};
  function inspect(documentRef = document) {
    let total = 0, looping = 0, running = 0;
    for (const animation of documentRef.getAnimations()) {
      total++;
      if (animation.playState === 'running') running++;
      try {
        const timing = animation.effect?.getComputedTiming();
        if (timing && (!Number.isFinite(timing.iterations) || timing.iterations > 3)) looping++;
      } catch (_) { /* animação não inspecionável */ }
    }
    return { total, looping, running, score: total ? looping / total : 0 };
  }
  A.motion = { inspect };
})();
