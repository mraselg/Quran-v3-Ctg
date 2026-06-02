export type MeasureRequest = {
  id: string;
  text: string;
  widthPx: number;
  heightPx: number;
  fontFamily: string;
  fontPx: number;
  leadingMult: number;
};

export type MeasureResponse = {
  id: string;
  fits: string;
  overflow: string;
};

let ctx: OffscreenCanvasRenderingContext2D | null = null;

self.onmessage = (e: MessageEvent<MeasureRequest>) => {
  const req = e.data;
  
  if (!ctx) {
    const canvas = new OffscreenCanvas(1, 1);
    ctx = canvas.getContext('2d', { willReadFrequently: true }) as OffscreenCanvasRenderingContext2D | null;
  }

  if (ctx) {
      ctx.font = `${req.fontPx}px ${req.fontFamily}`;
      const words = req.text.split(' ');
      
      let fits = [];
      let currentLine = '';
      let lines = 1;
      const maxLines = Math.floor(req.heightPx / (req.fontPx * req.leadingMult));
    
      for (let i = 0; i < words.length; i++) {
        const testLine = currentLine ? `${currentLine} ${words[i]}` : words[i];
        const width = ctx.measureText(testLine).width;
        
        if (width > req.widthPx) {
          if (lines >= maxLines) {
            // Area is full; the rest is overflow
            // Wait, if currentLine fits but `testLine` didn't, currentLine belongs in fits.
            // Then words.slice(i) is overflow.
            fits.push(currentLine);
            const overflow = words.slice(i).join(' ');
            self.postMessage({ id: req.id, fits: fits.join(' '), overflow });
            return;
          }
          fits.push(currentLine);
          currentLine = words[i];
          lines++;
        } else {
          currentLine = testLine;
        }
      }
      
      if (currentLine) {
        fits.push(currentLine);
      }
      self.postMessage({ id: req.id, fits: fits.join(' '), overflow: '' });
  } else {
      self.postMessage({ id: req.id, fits: req.text, overflow: '' });
  }
};
