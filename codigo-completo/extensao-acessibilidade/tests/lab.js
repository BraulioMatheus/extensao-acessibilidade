(() => {
  const source = document.createElement('canvas');
  source.width = 160; source.height = 90;
  const ctx = source.getContext('2d');
  let started = performance.now();
  const video = document.getElementById('originalSource');
  const rows = [];
  function render(t) {
    const seconds = (t - started) / 1000;
    // Frequência lenta, contraste moderado. Sem flashes agressivos.
    const gray = Math.round(155 + 12 * Math.sin(seconds * Math.PI * 0.5));
    ctx.fillStyle = `rgb(${gray},${gray},${gray})`;
    ctx.fillRect(0, 0, source.width, source.height);
    ctx.fillStyle = '#6385a1';
    ctx.fillRect(20 + Math.round(10 * Math.sin(seconds)), 34, 40, 20);
    ctx.fillStyle = '#f6f7f9';
    ctx.font = '11px sans-serif';
    ctx.fillText('TESTE CONTROLADO', 14, 18);
    requestAnimationFrame(render);
  }
  requestAnimationFrame(render);
  if ('captureStream' in source) {
    video.srcObject = source.captureStream(15);
    video.play().catch(() => {});
  } else {
    document.getElementById('ava-live-report').textContent = 'O navegador não oferece canvas.captureStream().';
  }
  document.addEventListener('ava:analysis', event => {
    rows.push(event.detail);
    if (rows.length > 300) rows.shift();
  });
  document.getElementById('downloadData').addEventListener('click', () => {
    if (!rows.length) { alert('Ainda não existem amostras. Ative a análise.'); return; }
    const columns = Object.keys(rows[0]);
    const csv = [columns.join(','), ...rows.map(row => columns.map(key => String(row[key] ?? '')).join(','))].join('\n');
    const blob = new Blob([csv], {type:'text/csv;charset=utf-8'});
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a'); link.href = url;
    link.download = 'metricas-ava-experimento.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });
})();
