/* Extrai pixels de imagens autorizadas, em resolução limitada. */
(() => {
  const A = globalThis.AVA ||= {};
  const SIZE = { maxWidth: 160, maxHeight: 90 };
  function dimensions(width, height, maxWidth = SIZE.maxWidth, maxHeight = SIZE.maxHeight) {
    const scale = Math.min(1, maxWidth / Math.max(1, width), maxHeight / Math.max(1, height));
    return { width: Math.max(1, Math.round(width * scale)),
      height: Math.max(1, Math.round(height * scale)) };
  }
  function createCanvas(width, height) {
    const canvas = document.createElement('canvas');
    canvas.width = width; canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    if (!context) throw new Error('Contexto Canvas 2D indisponível.');
    return { canvas, context };
  }
  function fromImage(img) {
    if (!img.complete || !img.naturalWidth || !img.naturalHeight) return null;
    const { width, height } = dimensions(img.naturalWidth, img.naturalHeight);
    const { context } = createCanvas(width, height);
    try {
      context.drawImage(img, 0, 0, width, height);
      return context.getImageData(0, 0, width, height);
    } catch (error) {
      if (error.name === 'SecurityError') return null; // CORS: não tentar contornar.
      throw error;
    }
  }
  A.imageReader = { SIZE, dimensions, createCanvas, fromImage };
})();
