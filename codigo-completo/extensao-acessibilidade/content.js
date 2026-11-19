/* AVA 0.7: mantém perfis e preserva as sessões ao ajustar parâmetros. */
(() => {
  if (globalThis.__avaV5Initialized) return;
  globalThis.__avaV5Initialized = true;
  const A = globalThis.AVA;
  const STORAGE_KEY = A.settings.STORAGE_KEY;
  const STYLE_ID = 'ava-v4-styles';
  let state = null;
  let poll = null;
  let imageSeen = new WeakMap();
  const pausedAnimations = new Set();
  const pausedVideos = new Set();
  const videoSessions = new Map();
  let animationPauseOn = false;

  function styles() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      html.ava-v4-filter { filter: brightness(var(--ava-brightness,1)) contrast(var(--ava-contrast,1)) !important; }
      html.ava-v4-paused *, html.ava-v4-paused *::before, html.ava-v4-paused *::after {
        animation-play-state: paused !important; transition-duration: 0s !important;
      }
      html.ava-v4-hide-gif img[src*=".gif" i], html.ava-v4-hide-gif img[data-ava-gif="1"] {
        visibility: hidden !important;
      }
      img.ava-v4-pattern { filter: contrast(var(--ava-pattern-contrast,0.85)) !important; }
      canvas.ava-v4-preview, canvas.ava-v5-preview { display:block; width:min(100%,960px); height:auto; border:1px solid #64748b; border-radius:8px; background:#1f2937; }
    `;
    document.documentElement.append(style);
  }
  function enabled() { return A.settings.enabledHere(state, location.hostname); }
  function profile() {
    return state?.profiles?.[state.activeProfile] || A.settings.defaultProfile;
  }
  function pauseAnimations() {
    if (!animationPauseOn) return;
    for (const anim of document.getAnimations()) {
      if (anim.playState === 'running') {
        try { anim.pause(); pausedAnimations.add(anim); } catch (_) {}
      }
    }
  }
  function resumeAnimations() {
    for (const anim of pausedAnimations) {
      try { if (anim.playState === 'paused') anim.play(); } catch (_) {}
    }
    pausedAnimations.clear();
  }
  function detectGif() {
    for (const image of document.images) {
      const url = image.currentSrc || image.src || '';
      image.toggleAttribute('data-ava-gif', /\.gif(?:$|[?#])/i.test(url) || /^data:image\/gif/i.test(url));
    }
  }
  function pauseVideos() {
    for (const video of document.querySelectorAll('video[loop]')) {
      if (!video.paused && !video.hasAttribute('data-ava-process')) {
        try { video.pause(); pausedVideos.add(video); } catch (_) {}
      }
    }
  }
  function resumeVideos() {
    for (const video of pausedVideos) {
      if (video.isConnected && video.paused) video.play().catch(() => {});
    }
    pausedVideos.clear();
  }

  function analyzeImages(p) {
    // Amostra apenas imagens acessíveis. Limite por rodada evita varreduras excessivas.
    let visited = 0;
    for (const img of document.images) {
      if (++visited > 60) break;
      if (img.closest('[data-ava-ignore]')) continue;
      const source = img.currentSrc || img.src || '';
      if (imageSeen.get(img) === source) continue;
      if (!img.complete || img.naturalWidth < 64 || img.naturalHeight < 64) continue;
      imageSeen.set(img, source);
      try {
        const data = A.imageReader.fromImage(img);
        if (!data) continue; // bloqueio CORS ou imagem ainda não disponível
        const pattern = A.contrast.analyze(A.luminance.analyze(data));
        const threshold = 0.80 - 0.70 * (p.sensitivity / 100);
        if (pattern.score >= threshold && p.smoothingMode !== 'off') {
          const strength = p.smoothingMode === 'fixed' ? 0.18 :
            Math.min(0.40, pattern.score * p.spatialStrength / 200);
          img.style.setProperty('--ava-pattern-contrast', String(1 - strength));
          img.classList.add('ava-v4-pattern');
        } else img.classList.remove('ava-v4-pattern');
      } catch (error) { console.debug('AVA: não foi possível analisar imagem', error); }
    }
  }

  function stopVideoSessions({ keepBuffered = false } = {}) {
    for (const [video, session] of videoSessions.entries()) {
      if (keepBuffered && session.type === 'buffered' && video.isConnected) {
        session.instance.updateProfile();
        continue;
      }
      if (typeof session.stop === 'function') session.stop();
      else { session.sampler.stop(); session.output.remove(); }
      videoSessions.delete(video);
    }
  }
  function connectLabVideo(video, p) {
    if (videoSessions.has(video) || !video.isConnected) return;
    // Somente mídias explicitamente marcadas pelo autor da página de laboratório.
    // Não substitui vídeos arbitrários e não assegura filtragem antes da exibição.
    const output = document.createElement('canvas');
    output.width = 160; output.height = 90;
    output.className = 'ava-v4-preview';
    output.title = 'Prévia experimental de vídeo analisado pela extensão';
    output.setAttribute('role', 'img');
    output.setAttribute('aria-label', 'Quadros do vídeo processados experimentalmente');
    video.insertAdjacentElement('afterend', output);
    const outCtx = output.getContext('2d');
    if (!outCtx) { output.remove(); return; }
    const detector = new A.flash.FlashDetector();
    const temporal = new A.temporal.TemporalFilter();
    let lastTime = 0, frameCounter = 0;
    let latencyMs = 0;
    const sampler = new A.videoReader.VideoSampler(video, (data, timeMs) => {
      const begin = performance.now();
      const stats = A.luminance.analyze(data);
      const flash = detector.push(stats, timeMs);
      const pattern = A.contrast.analyze(stats);
      const choice = A.adaptive.decide({ flash, pattern }, profile());
      let processed = temporal.apply(data, choice.alpha);
      if (choice.spatial > 0.005) processed = A.spatial.gaussian3x3(processed, choice.spatial);
      outCtx.putImageData(new ImageData(processed.data, processed.width, processed.height), 0, 0);
      latencyMs = performance.now() - begin;
      frameCounter++;
      if (frameCounter % 12 === 0) {
        const report = {
          timeMs: Math.round(timeMs),
          luminance: Number(stats.mean.toFixed(4)),
          flashScore: Number(flash.score.toFixed(3)),
          flashesLastSecond: flash.rate,
          patternScore: Number(pattern.score.toFixed(3)),
          coefficient: Number(choice.alpha.toFixed(3)),
          temporalMode: choice.mode,
          processingMs: Number(latencyMs.toFixed(2)),
          frameCount: frameCounter
        };
        const view = document.querySelector('#ava-live-report');
        if (view) view.textContent = JSON.stringify(report, null, 2);
        // Somente para o laboratório; não transmite dados para servidores.
        document.dispatchEvent(new CustomEvent('ava:analysis', { detail: report }));
      }
      lastTime = timeMs;
    }, (error) => {
      const view = document.querySelector('#ava-live-report');
      if (view) view.textContent = 'Sem acesso aos pixels: ' + error.message;
      console.warn('AVA: vídeo inacessível (possivelmente CORS)', error);
      output.remove(); videoSessions.delete(video);
    });
    videoSessions.set(video, { sampler, output });
    sampler.start();
  }

  function connectBufferedVideo(video) {
    if (videoSessions.has(video) || !video.isConnected) return;
    // Apenas vídeo explicitamente marcado numa página controlada. Nunca exibe a fonte original.
    const setStatus = (message) => {
      const status = document.querySelector('#ava-buffer-status');
      if (status) status.textContent = message;
      document.dispatchEvent(new CustomEvent('ava:buffer-status', { detail: { message } }));
    };
    const buffered = new A.frameBuffer.BufferedVideoSession(video, profile, {
      onStatus: setStatus,
      onReport: report => {
        const box = document.querySelector('#ava-live-report');
        if (box) box.textContent = JSON.stringify(report, null, 2);
        document.dispatchEvent(new CustomEvent('ava:analysis', { detail: JSON.stringify(report) }));
      },
      onError: error => {
        console.warn('AVA: falha no buffer experimental:', error);
        setStatus('Falha na análise: ' + error.message);
        videoSessions.delete(video);
      }
    });
    videoSessions.set(video, { type: 'buffered', instance: buffered, stop: () => buffered.stop() });
    buffered.start();
  }
  function scan() {
    if (!enabled()) return;
    const p = profile();
    if (p.pauseAnimations) pauseAnimations();
    if (p.hideGifs) detectGif();
    if (p.pauseLoopVideos) pauseVideos();
    if (!p.automaticAnalysis) return;
    analyzeImages(p);
    for (const video of document.querySelectorAll('video[data-ava-process="video"]')) {
      connectLabVideo(video, p);
    }
    for (const video of document.querySelectorAll('video[data-ava-process="buffered"]')) {
      connectBufferedVideo(video);
    }
  }
  function stopTimer() { if (poll != null) { clearInterval(poll); poll = null; } }
  function apply() {
    styles(); stopTimer();
    // Alterar um perfil não desmonta a sessão de vídeo: evita saltos,
    // resets de buffer e a interrupção do áudio configurado na página.
    const keepBuffered = enabled() && Boolean(profile().automaticAnalysis);
    stopVideoSessions({ keepBuffered });
    imageSeen = new WeakMap();
    document.querySelectorAll('img.ava-v4-pattern').forEach(img => {
      img.classList.remove('ava-v4-pattern');
      img.style.removeProperty('--ava-pattern-contrast');
    });
    const on = enabled();
    const p = profile();
    const root = document.documentElement;
    root.classList.toggle('ava-v4-filter', on && (p.brightness !== 100 || p.contrast !== 100));
    root.classList.toggle('ava-v4-paused', on && p.pauseAnimations);
    root.classList.toggle('ava-v4-hide-gif', on && p.hideGifs);
    root.style.setProperty('--ava-brightness', String(p.brightness / 100));
    root.style.setProperty('--ava-contrast', String(p.contrast / 100));
    animationPauseOn = on && p.pauseAnimations;
    if (!animationPauseOn) resumeAnimations();
    if (!on || !p.pauseLoopVideos) resumeVideos();
    if (on && (p.pauseAnimations || p.hideGifs || p.pauseLoopVideos || p.automaticAnalysis)) {
      scan();
      poll = setInterval(scan, 1400);
    }
  }
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area !== 'local' || !changes[STORAGE_KEY]) return;
    state = A.settings.normalizeState(changes[STORAGE_KEY].newValue);
    apply();
  });
  chrome.storage.local.get(STORAGE_KEY).then(result => {
    state = A.settings.normalizeState(result[STORAGE_KEY]);
    apply();
  }).catch(error => console.warn('AVA: erro ao ler configurações', error));
})();
