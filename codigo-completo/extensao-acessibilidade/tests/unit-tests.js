(() => {
  const A = window.AVA;
  const output = document.getElementById('results');
  const results = [];
  let passed = 0, failed = 0;
  const approx = (x, y, eps = 1e-4) => Math.abs(x - y) < eps;
  const test = (name, fn) => {
    try { fn(); passed++; results.push('✓ ' + name); }
    catch (err) { failed++; results.push('✗ ' + name + ' — ' + err.message); }
  };
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  const pixelFrame = (w, h, rgb) => {
    const data = new Uint8ClampedArray(w * h * 4);
    for (let i = 0; i < data.length; i += 4) {
      data.set([...rgb, 255], i);
    }
    return { width: w, height: h, data };
  };
  test('luminância de branco = 1', () => assert(approx(A.luminance.relative(255,255,255),1), 'branco'));
  test('luminância de preto = 0', () => assert(approx(A.luminance.relative(0,0,0),0), 'preto'));
  test('RGB sRGB lineariza corretamente', () => assert(approx(A.luminance.linearize(128),0.21586,0.001), 'sRGB'));
  test('média de pixels preto/branco', () => {
    const f={width:2,height:1,data:new Uint8ClampedArray([0,0,0,255,255,255,255,255])};
    assert(approx(A.luminance.analyze(f).mean,0.5), 'média 0.5');
  });
  test('contraste de Michelson', () => assert(approx(A.contrast.michelson(1,0),1), 'contraste 1'));
  test('detecção de alternância oposta', () => {
    const detector = new A.flash.FlashDetector({ threshold:0.1 });
    const make=(v)=>({ tileMeans:Array(48).fill(v), tileRedness:Array(48).fill(0) });
    detector.push(make(.2),0); detector.push(make(.8),200);
    const res=detector.push(make(.2),400);
    assert(res.events===1 && res.rate===1,'deveria contar um par');
  });
  test('EMA temporal com alfa 0.5', () => {
    const filter=new A.temporal.TemporalFilter();
    filter.apply(pixelFrame(1,1,[0,0,0]),0.5);
    const result=filter.apply(pixelFrame(1,1,[200,200,200]),0.5);
    assert(result.data[0]===100,'interpolação 100');
  });
  test('desfoque preserva região uniforme', () => {
    const frame=pixelFrame(3,3,[80,80,80]);
    const blurred=A.spatial.gaussian3x3(frame,0.8);
    assert(blurred.data[4*3]===80, 'deveria manter 80');
  });
  test('coeficiente adaptativo diminui com intensidade', () => {
    const p={...A.settings.defaultProfile};
    const low=A.adaptive.decide({flash:{score:0},pattern:{score:0}},p);
    const high=A.adaptive.decide({flash:{score:1},pattern:{score:0}},p);
    assert(high.alpha < low.alpha, 'maior estímulo, menor alfa');
  });
  test('suavização fixa usa mesmo alfa para sinais distintos', () => {
    const p={...A.settings.defaultProfile,smoothingMode:'fixed'};
    const a=A.adaptive.decide({flash:{score:0}},p);
    const b=A.adaptive.decide({flash:{score:1}},p);
    assert(a.alpha===b.alpha,'constante');
  });
  test('F1-score de exemplo', () => {
    const m=A.metrics.classification([true,true,false,false],[true,false,true,false]);
    assert(m.tp===1 && m.fp===1 && m.fn===1 && approx(m.f1,0.5),'F1');
  });
  test('buffer não entrega quadro antes do atraso', () => {
    const queue = new A.frameBuffer.FrameQueue({ delayMs: 400, maxFrames: 5 });
    queue.push({capturedAt: 1000, frame: {data: new Uint8ClampedArray(4)}, report: {}});
    assert(queue.takeReady(1399).entry === null, 'entrega prematura');
    assert(queue.length === 1, 'quadro perdido');
    assert(queue.takeReady(1400).entry !== null, 'não entregou no tempo');
  });
  test('buffer respeita limite de memória', () => {
    const queue = new A.frameBuffer.FrameQueue({ delayMs: 400, maxFrames: 8, maxBytes: 8 });
    for (let i=0; i<3; i++) queue.push({capturedAt:i,frame:{data:new Uint8ClampedArray(4)},report:{}});
    assert(queue.length===2 && queue.dropped===1, 'limite de bytes');
  });
  test('buffer descarta quadros vencidos, mantendo o mais recente', () => {
    const queue = new A.frameBuffer.FrameQueue({delayMs:200, maxFrames:10});
    for (const t of [100,150,200]) queue.push({capturedAt:t,frame:{data:new Uint8ClampedArray(4)},report:{t}});
    const ready = queue.takeReady(550);
    assert(ready.entry.report.t===200 && ready.skipped===2, 'quadros vencidos');
    assert(queue.length===0, 'fila deveria esvaziar');
  });
  test('buffer esvazia em reinício', () => {
    const queue = new A.frameBuffer.FrameQueue({delayMs:400});
    queue.push({capturedAt:10,frame:{data:new Uint8ClampedArray(4)},report:{}});
    queue.clear();
    assert(queue.length===0 && queue.bytes===0, 'reset');
  });
  test('buffer descarta quadro muito antigo após retorno à aba', () => {
    const queue = new A.frameBuffer.FrameQueue({ delayMs:400 });
    queue.push({capturedAt:100,frame:{data:new Uint8ClampedArray(4)},report:{}});
    const result = queue.takeReady(75000, 180);
    assert(result.entry === null && queue.dropped === 1, 'quadro obsoleto foi exibido');
  });
  test('buffer preserva cadência dos quadros se estiver dentro da tolerância', () => {
    const queue = new A.frameBuffer.FrameQueue({ delayMs:400 });
    queue.push({capturedAt:1000,frame:{data:new Uint8ClampedArray(4)},report:{t:1}});
    queue.push({capturedAt:1033,frame:{data:new Uint8ClampedArray(4)},report:{t:2}});
    assert(queue.takeReady(1405, 180).entry.report.t === 1, 'primeiro quadro');
    assert(queue.takeReady(1440, 180).entry.report.t === 2, 'segundo quadro');
    assert(queue.dropped === 0, 'perda inesperada');
  });
  test('normalização de atraso e volume de áudio', () => {
    const C = A.audioSync.AudioSyncController;
    assert(C.clamp(400,200,1000) === 400, 'atraso');
    assert(C.clamp(3000,200,1000) === 1000, 'limite de atraso');
    assert(C.clamp(-1,0,1) === 0, 'volume');
  });
  test('filtro espacial otimizado preserva canal alfa', () => {
    const f=pixelFrame(3,3,[90,90,90]);
    const out=A.spatial.gaussian3x3(f,1);
    assert(out.data[3]===255 && out.data[0]===90,'uniformidade / alfa');
  });
  test('qualidade mantém proporção sem extrapolar limite', () => {
    const a = A.frameBuffer.limitForMode('quality');
    assert(a[0]===1280 && a[1]===720, 'tamanho qualidade');
    const b = A.frameBuffer.limitForMode('balanced');
    assert(b[0]===854 && b[1]===480, 'tamanho equilibrado');
  });
  test('quadros descartados liberam ImageBitmap', () => {
    let released=0;
    const q=new A.frameBuffer.FrameQueue({delayMs:200,maxFrames:1});
    const mk=()=>({width:2,height:2,close(){released++;}});
    q.push({capturedAt:0,frame:mk()});
    q.push({capturedAt:40,frame:mk()});
    q.clear();
    assert(released===2, 'recursos não liberados');
  });
  test('índice de movimento nulo para alteração uniforme', () => {
    const old=new Float32Array(48).fill(0.2), now=new Float32Array(48).fill(0.7);
    assert(A.frameBuffer.motionIndex(old,now,0.2,0.7)<0.0001, 'flash uniforme não é movimento');
  });
  test('anti-rastro só altera a suavização adaptativa', () => {
    assert(A.frameBuffer.compensateMotion(0.3,1,0.1,'adaptive')>0.8,'deveria reduzir rastro');
    assert(A.frameBuffer.compensateMotion(0.3,1,0.1,'fixed')===0.3,'referência fixa deve ser mantida');
    assert(A.frameBuffer.compensateMotion(0.3,1,0.8,'adaptive')===0.3,'não deve anular intervenção em flash');
  });
  results.push(`\nRESULTADO: ${passed} aprovados, ${failed} falharam.`);
  output.textContent=results.join('\n');
  output.dataset.passed=String(passed);
  output.dataset.failed=String(failed);
})();
