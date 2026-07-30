import React, { useEffect, useRef, useState, useCallback } from 'react';

// ─── Constants ────────────────────────────────────────────────────────────────
const TOOLS = { PEN: 'pen', LINE: 'line', RECT: 'rect', CIRCLE: 'circle', TEXT: 'text', ERASER: 'eraser' };
const COLORS = ['#000000','#e74c3c','#e67e22','#f1c40f','#2ecc71','#3498db','#9b59b6','#ffffff'];

// ─── Helpers ──────────────────────────────────────────────────────────────────
const getPos = (e, canvas) => {
  const rect = canvas.getBoundingClientRect();
  const scaleX = canvas.width / rect.width;
  const scaleY = canvas.height / rect.height;
  const src = e.touches ? e.touches[0] : e;
  return {
    x: (src.clientX - rect.left) * scaleX,
    y: (src.clientY - rect.top)  * scaleY
  };
};

const redrawAll = (ctx, strokes) => {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  strokes.forEach(s => drawStroke(ctx, s));
};

const drawStroke = (ctx, s) => {
  ctx.save();
  ctx.strokeStyle = s.color;
  ctx.fillStyle   = s.color;
  ctx.lineWidth   = s.size;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.globalCompositeOperation = s.tool === TOOLS.ERASER ? 'destination-out' : 'source-over';

  switch (s.tool) {
    case TOOLS.PEN:
    case TOOLS.ERASER: {
      if (!s.points || s.points.length < 2) break;
      ctx.beginPath();
      ctx.moveTo(s.points[0].x, s.points[0].y);
      s.points.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
      ctx.stroke();
      break;
    }
    case TOOLS.LINE: {
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(s.x1, s.y1);
      ctx.stroke();
      break;
    }
    case TOOLS.RECT: {
      ctx.beginPath();
      ctx.strokeRect(s.x0, s.y0, s.x1 - s.x0, s.y1 - s.y0);
      break;
    }
    case TOOLS.CIRCLE: {
      const rx = Math.abs(s.x1 - s.x0) / 2;
      const ry = Math.abs(s.y1 - s.y0) / 2;
      const cx = s.x0 + (s.x1 - s.x0) / 2;
      const cy = s.y0 + (s.y1 - s.y0) / 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.stroke();
      break;
    }
    case TOOLS.TEXT: {
      ctx.font = `${s.size * 6}px sans-serif`;
      ctx.globalCompositeOperation = 'source-over';
      ctx.fillText(s.text, s.x0, s.y0);
      break;
    }
    default: break;
  }
  ctx.restore();
};

// ─── Component ────────────────────────────────────────────────────────────────
export default function Whiteboard({ socket, roomId, participantName, onClose }) {
  const canvasRef   = useRef(null);
  const overlayRef  = useRef(null); // preview layer for shapes
  const strokesRef  = useRef([]);   // source of truth for all committed strokes

  const [tool,    setTool]    = useState(TOOLS.PEN);
  const [color,   setColor]   = useState('#000000');
  const [size,    setSize]    = useState(4);
  const [drawing, setDrawing] = useState(false);

  // Current in-progress stroke data
  const currentRef = useRef(null);
  // Text input overlay
  const [textInput, setTextInput] = useState(null); // { x, y }
  const [textValue, setTextValue] = useState('');

  // ── Canvas setup ────────────────────────────────────────────────────────────
  const getCtx  = () => canvasRef.current?.getContext('2d');
  const getOCtx = () => overlayRef.current?.getContext('2d');

  // ── Commit a stroke locally + emit to server ─────────────────────────────
  const commitStroke = useCallback((stroke) => {
    strokesRef.current.push(stroke);
    drawStroke(getCtx(), stroke);
    socket?.emit('wb-draw', { roomId, stroke });
  }, [socket, roomId]);

  // ── Socket listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    // Another participant drew something
    const onDraw = ({ stroke }) => {
      strokesRef.current.push(stroke);
      drawStroke(getCtx(), stroke);
    };

    // Board was cleared
    const onClear = () => {
      strokesRef.current = [];
      const ctx = getCtx();
      if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    };

    // Server sends full board state when we join
    const onStateSync = ({ strokes }) => {
      strokesRef.current = strokes;
      redrawAll(getCtx(), strokes);
    };

    socket.on('wb-draw',       onDraw);
    socket.on('wb-clear',      onClear);
    socket.on('wb-state-sync', onStateSync);

    // Request current board state from server
    socket.emit('wb-state-request', { roomId });

    return () => {
      socket.off('wb-draw',       onDraw);
      socket.off('wb-clear',      onClear);
      socket.off('wb-state-sync', onStateSync);
    };
  }, [socket, roomId]);

  // ── Pointer events ──────────────────────────────────────────────────────────
  const onPointerDown = useCallback((e) => {
    e.preventDefault();
    const canvas = canvasRef.current;
    if (!canvas) return;
    const pos = getPos(e, canvas);

    if (tool === TOOLS.TEXT) {
      setTextInput(pos);
      setTextValue('');
      return;
    }

    setDrawing(true);
    currentRef.current = {
      tool, color,
      size: tool === TOOLS.ERASER ? size * 4 : size,
      x0: pos.x, y0: pos.y,
      x1: pos.x, y1: pos.y,
      points: [pos]
    };
  }, [tool, color, size]);

  const onPointerMove = useCallback((e) => {
    e.preventDefault();
    if (!drawing || !currentRef.current) return;
    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    const s = currentRef.current;

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      s.points.push(pos);
      // Draw incremental segment directly on main canvas
      const ctx = getCtx();
      ctx.save();
      ctx.strokeStyle = s.color;
      ctx.lineWidth   = s.size;
      ctx.lineCap     = 'round';
      ctx.lineJoin    = 'round';
      ctx.globalCompositeOperation = tool === TOOLS.ERASER ? 'destination-out' : 'source-over';
      ctx.beginPath();
      const pts = s.points;
      ctx.moveTo(pts[pts.length - 2].x, pts[pts.length - 2].y);
      ctx.lineTo(pos.x, pos.y);
      ctx.stroke();
      ctx.restore();
    } else {
      // Shape preview on overlay canvas
      s.x1 = pos.x;
      s.y1 = pos.y;
      const oct = getOCtx();
      if (oct) {
        oct.clearRect(0, 0, oct.canvas.width, oct.canvas.height);
        drawStroke(oct, s);
      }
    }
  }, [drawing, tool]);

  const onPointerUp = useCallback((e) => {
    e.preventDefault();
    if (!drawing || !currentRef.current) return;
    setDrawing(false);

    const canvas = canvasRef.current;
    const pos = getPos(e, canvas);
    const s = currentRef.current;
    s.x1 = pos.x;
    s.y1 = pos.y;

    // Clear overlay
    const oct = getOCtx();
    if (oct) oct.clearRect(0, 0, oct.canvas.width, oct.canvas.height);

    if (tool === TOOLS.PEN || tool === TOOLS.ERASER) {
      // Already drawn incrementally — just emit
      socket?.emit('wb-draw', { roomId, stroke: s });
      strokesRef.current.push(s);
    } else {
      commitStroke(s);
    }
    currentRef.current = null;
  }, [drawing, tool, commitStroke, socket, roomId]);

  // ── Text commit ─────────────────────────────────────────────────────────────
  const commitText = useCallback(() => {
    if (!textInput || !textValue.trim()) { setTextInput(null); return; }
    const stroke = { tool: TOOLS.TEXT, color, size, x0: textInput.x, y0: textInput.y, text: textValue.trim() };
    commitStroke(stroke);
    setTextInput(null);
    setTextValue('');
  }, [textInput, textValue, color, size, commitStroke]);

  // ── Clear board ─────────────────────────────────────────────────────────────
  const clearBoard = useCallback(() => {
    strokesRef.current = [];
    const ctx = getCtx();
    if (ctx) ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    socket?.emit('wb-clear', { roomId });
  }, [socket, roomId]);

  // ── Cursor style ─────────────────────────────────────────────────────────────
  const cursorStyle = tool === TOOLS.ERASER ? 'cell'
    : tool === TOOLS.TEXT ? 'text' : 'crosshair';

  return (
    <div className="wb-container" onClick={e => e.stopPropagation()}>
      {/* Header */}
      <div className="wb-header">
        <span className="wb-title">🖊 Collaborative Whiteboard</span>
        <button className="wb-close-btn" onClick={onClose}>✕</button>
      </div>

      {/* Toolbar */}
      <div className="wb-toolbar">
        {/* Tools */}
        <div className="wb-tool-group">
          {Object.values(TOOLS).map(t => (
            <button
              key={t}
              className={`wb-tool-btn ${tool === t ? 'active' : ''}`}
              onClick={() => setTool(t)}
              title={t.charAt(0).toUpperCase() + t.slice(1)}
            >
              {t === TOOLS.PEN     && '✏️'}
              {t === TOOLS.LINE    && '╱'}
              {t === TOOLS.RECT    && '▭'}
              {t === TOOLS.CIRCLE  && '○'}
              {t === TOOLS.TEXT    && 'T'}
              {t === TOOLS.ERASER  && '⌫'}
            </button>
          ))}
        </div>

        {/* Colors */}
        <div className="wb-tool-group">
          {COLORS.map(c => (
            <button
              key={c}
              className={`wb-color-btn ${color === c ? 'active' : ''}`}
              style={{ background: c, border: color === c ? '3px solid #fff' : '2px solid rgba(255,255,255,0.3)' }}
              onClick={() => setColor(c)}
              title={c}
            />
          ))}
        </div>

        {/* Size */}
        <div className="wb-tool-group">
          <label className="wb-size-label">Size</label>
          <input
            type="range" min="1" max="20" value={size}
            onChange={e => setSize(Number(e.target.value))}
            className="wb-size-slider"
          />
          <span className="wb-size-val">{size}</span>
        </div>

        {/* Clear */}
        <button className="wb-clear-btn" onClick={clearBoard} title="Clear board">🗑 Clear</button>
      </div>

      {/* Canvas area */}
      <div className="wb-canvas-wrap">
        <canvas
          ref={canvasRef}
          width={1200} height={700}
          className="wb-canvas"
          style={{ cursor: cursorStyle }}
          onMouseDown={onPointerDown}
          onMouseMove={onPointerMove}
          onMouseUp={onPointerUp}
          onMouseLeave={onPointerUp}
          onTouchStart={onPointerDown}
          onTouchMove={onPointerMove}
          onTouchEnd={onPointerUp}
        />
        {/* Overlay for shape preview */}
        <canvas
          ref={overlayRef}
          width={1200} height={700}
          className="wb-canvas wb-overlay"
          style={{ pointerEvents: 'none' }}
        />
        {/* Text input */}
        {textInput && (
          <input
            autoFocus
            className="wb-text-input"
            style={{ left: textInput.x, top: textInput.y, color, fontSize: size * 6 }}
            value={textValue}
            onChange={e => setTextValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') commitText(); if (e.key === 'Escape') setTextInput(null); }}
            onBlur={commitText}
            placeholder="Type here…"
          />
        )}
      </div>

      <div className="wb-footer">
        <span>✏️ {participantName}</span>
        <span className="wb-hint">Shift+click canvas to place text • Esc to cancel</span>
      </div>
    </div>
  );
}
