(() => {
  const $ = (id) => document.getElementById(id);
  const video = $('sourceVideo');
  const rows = [];
  let videoUrl = null;
  const audio = new AVA.audioSync.AudioSyncController(video, message => {
    $('audioStatus').textContent = message;
  });
  function updateAudioUI() {
    $('audioToggle').textContent = audio.enabled ? 'Desativar áudio' : 'Ativar áudio sincronizado';
    $('audioToggle').setAttribute('aria-pressed', String(audio.enabled));
  }
  $('audioToggle').addEventListener('click', async () => {
    if (audio.enabled) {
      audio.disable();
    } else {
      try {
        await audio.enable(Number(video.dataset.avaBufferDelayMs || 400), Number($('audioVolume').value) / 100);
      } catch (error) {
        console.warn('AVA: não foi possível ativar o áudio', error);
      }
    }
    updateAudioUI();
  });
  $('audioVolume').addEventListener('input', () => {
    $('audioVolumeValue').textContent = `${$('audioVolume').value}%`;
    audio.setVolume(Number($('audioVolume').value) / 100);
  });
  video.addEventListener('ava:buffer-config', (event) => {
    audio.setDelay(Number(event.detail) || 400);
  });
  video.addEventListener('ava:buffer-detached', () => {
    audio.disable();
    updateAudioUI();
    $('audioStatus').textContent = 'Análise desativada. Reative o áudio após habilitar o buffer.';
  });
  video.addEventListener('seeking', () => audio.flush());
  video.addEventListener('emptied', () => audio.flush());
  updateAudioUI();
  const fields = [
    'sourceTimeMs', 'averageLuminance', 'flashScore', 'flashesLastSecond',
    'patternScore', 'alpha', 'smoothingMode', 'originalDeltaLuminance',
    'processedDeltaLuminance', 'deltaReductionPct', 'processingMs',
    'bufferTargetMs', 'actualBufferMs', 'queuedFrames', 'droppedFrames',
    'framesCaptured', 'framesDisplayed', 'frameWidth', 'frameHeight', 'analysisWidth', 'analysisHeight', 'qualityMode', 'frameBytes', 'motionScore', 'rawAlpha', 'estimatedProcessedDeltaLuminance',
    'schedulingLatenessMs', 'displayIntervalMs', 'audioEnabled', 'audioDelayMs', 'audioContextState'
  ];
  function controls(active) {
    for (const id of ['play', 'pause', 'restart']) $(id).disabled = !active;
  }
  $('file').addEventListener('change', async () => {
    const file = $('file').files?.[0];
    if (!file) return;
    if (!file.type.startsWith('video/') && !/\.(mp4|webm|ogg|m4v)$/i.test(file.name)) {
      $('fileStatus').textContent = 'Escolha um arquivo de vídeo compatível com o Chrome.';
      return;
    }
    audio.disable(); updateAudioUI();
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = URL.createObjectURL(file);
    rows.length = 0;
    $('sampleStatus').textContent = '0 amostras exibidas.';
    $('ava-live-report').textContent = 'Novo arquivo selecionado; aguardando buffer...';
    video.src = videoUrl;
    video.muted = true;
    video.volume = 1;
    video.load();
    $('fileStatus').textContent = `${file.name} — ${(file.size / 1024 / 1024).toFixed(1)} MB.`;
    controls(true);
    $('audioToggle').disabled = false;
    try { await video.play(); }
    catch (_) { $('fileStatus').textContent += ' Clique em Reproduzir.'; }
  });
  $('sample').addEventListener('click', async () => {
    audio.disable(); updateAudioUI();
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = null;
    rows.length = 0;
    $('sampleStatus').textContent = '0 amostras exibidas.';
    $('ava-live-report').textContent = 'Aguardando vídeo de exemplo...';
    video.src = new URL('fixtures/video-suave.mp4', location.href).href;
    video.muted = true;
    video.volume = 1;
    video.load();
    $('fileStatus').textContent = 'Vídeo de exemplo: 6 segundos, pequenas variações de luminância.';
    controls(true);
    $('audioToggle').disabled = false;
    try { await video.play(); }
    catch (_) { $('fileStatus').textContent += ' Clique em Reproduzir.'; }
  });
  $('sampleAudio').addEventListener('click', async () => {
    audio.disable(); updateAudioUI();
    video.pause();
    video.removeAttribute('src');
    video.load();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = null;
    rows.length = 0;
    $('sampleStatus').textContent = '0 amostras exibidas.';
    $('ava-live-report').textContent = 'Aguardando vídeo com áudio de exemplo...';
    video.src = new URL('fixtures/video-com-audio-suave.mp4', location.href).href;
    video.muted = true;
    video.volume = 1;
    video.load();
    $('fileStatus').textContent = 'Exemplo original de 6 s: som suave no início de cada segundo (1 a 5).';
    controls(true);
    $('audioToggle').disabled = false;
    try { await video.play(); }
    catch (_) { $('fileStatus').textContent += ' Clique em Reproduzir.'; }
  });
  $('sampleHD').addEventListener('click', async () => {
    audio.disable(); updateAudioUI();
    video.pause(); video.removeAttribute('src'); video.load();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
    videoUrl = null; rows.length = 0;
    $('sampleStatus').textContent = '0 amostras exibidas.';
    $('ava-live-report').textContent = 'Aguardando teste HD...';
    video.src = new URL('fixtures/video-nitidez-hd.mp4', location.href).href;
    video.muted = true; video.volume = 1; video.load();
    $('fileStatus').textContent = 'Exemplo 1280×720 com textos de diferentes tamanhos e movimento suave (sem áudio).';
    controls(true); $('audioToggle').disabled = true;
    try { await video.play(); } catch (_) {
      $('fileStatus').textContent += ' Clique em Reproduzir.';
    }
  });
  $('play').addEventListener('click', () => video.play().catch(e => {
    $('fileStatus').textContent = 'Erro ao reproduzir: ' + e.message;
  }));
  $('pause').addEventListener('click', () => video.pause());
  $('restart').addEventListener('click', () => {
    video.currentTime = 0;
    rows.length = 0;
    $('sampleStatus').textContent = '0 amostras exibidas.';
    video.play().catch(() => {});
  });
  video.addEventListener('error', () => {
    $('fileStatus').textContent = 'O Chrome não conseguiu abrir esse vídeo. Tente MP4 (H.264) ou WebM.';
  });
  document.addEventListener('ava:analysis', (event) => {
    let detail = event.detail;
    if (typeof detail === 'string') {
      try { detail = JSON.parse(detail); } catch (_) { return; }
    }
    if (!detail || detail.bufferTargetMs === undefined) return;
    const info = audio.information;
    rows.push({ ...detail, audioEnabled: info.enabled, audioDelayMs: info.enabled ? info.delayMs : null, audioContextState: info.state });
    if (rows.length > 20000) rows.shift();
    $('sampleStatus').textContent = `${rows.length} amostras de quadros apresentados.`;
  });
  function csvCell(value) {
    const str = String(value ?? '');
    return /[",\r\n]/.test(str) ? '"' + str.replaceAll('"', '""') + '"' : str;
  }
  $('export').addEventListener('click', () => {
    if (!rows.length) {
      alert('Ainda não há medições. Ative a extensão e reproduza o vídeo.');
      return;
    }
    const csv = [fields.join(','), ...rows.map(row =>
      fields.map(field => csvCell(row[field])).join(',')
    )].join('\r\n');
    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const href = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = href;
    link.download = `ava-buffer-${Date.now()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(href), 3000);
  });
  $('clear').addEventListener('click', () => {
    rows.length = 0;
    $('sampleStatus').textContent = '0 amostras exibidas.';
  });
  window.addEventListener('beforeunload', () => {
    audio.disable();
    video.pause();
    if (videoUrl) URL.revokeObjectURL(videoUrl);
  });
})();
