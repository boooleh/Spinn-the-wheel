import { useState, useEffect, useRef, useCallback } from "react";

const PALETTE = [
  '#e8515a','#f47c3c','#f5c842','#3db86b','#4a90d9',
  '#9b59b6','#e91e8c','#00bcd4','#ff7043','#8bc34a',
  '#795548','#607d8b','#e8515a','#3db86b','#f5c842',
  '#4a90d9','#9b59b6','#f47c3c','#00bcd4','#8bc34a',
];
const SWATCHES = [
  ['#e8515a','#f47c3c','#f5c842','#3db86b'],
  ['#4a90d9','#9b59b6','#e91e8c','#00bcd4'],
  ['#3db86b','#f5c842','#4a90d9','#e8515a'],
  ['#f47c3c','#8bc34a','#607d8b','#e91e8c'],
  ['#9b59b6','#e8515a','#00bcd4','#f5c842'],
];
const INIT_WHEELS = [
  { name: 'Stuff to do', items: ['Städa köket','Fixa disken','Plocka undan på bordet','Städa hallen','Släng soporna','Dammsug 1 rum','Städa badrum','Städa toaletten','Städa vardagsrum','Sortera tvätt','Städa matsal','Städa sovrum','Gör matlådor','Baka något','30 min promenad','Städa skrivbord'] },
  { name: 'Middag?', items: ['Pizza','Pasta','Soppa','Tacos','Sushi','Sallad','Gryta','Hamburgare'] },
];

function swatchBg(i) {
  const c = SWATCHES[i % SWATCHES.length];
  return `conic-gradient(${c[0]} 0 25%,${c[1]} 25% 50%,${c[2]} 50% 75%,${c[3]} 75%)`;
}

// ── Drag-to-reorder hook ──
function useDrag(items, onReorder) {
  const dragIdx = useRef(null);
  const handlers = (i) => ({
    draggable: true,
    onDragStart: () => { dragIdx.current = i; },
    onDragOver: (e) => { e.preventDefault(); },
    onDrop: () => {
      if (dragIdx.current === null || dragIdx.current === i) return;
      const next = [...items];
      const [moved] = next.splice(dragIdx.current, 1);
      next.splice(i, 0, moved);
      dragIdx.current = null;
      onReorder(next);
    },
  });
  return handlers;
}

export default function SpinWheel() {
  const [wheels, setWheels] = useState(INIT_WHEELS);
  const [activeIdx, setActiveIdx] = useState(0);
  const [newItem, setNewItem] = useState('');
  const [spinning, setSpinning] = useState(false);
  const [lastResult, setLastResult] = useState(null);       // #4 persistent result
  const [shake, setShake] = useState(false);                // #6 shake feedback
  const [editingIdx, setEditingIdx] = useState(null);       // #2 inline edit
  const [editingVal, setEditingVal] = useState('');
  const [modal, setModal] = useState({ open: false, mode: 'create', value: '' });
  const drawerRef = useRef(null);
  const canvasRef = useRef(null);
  const angleRef = useRef(0);
  const rafRef = useRef(null);
  const editInputRef = useRef(null);

  const items = wheels[activeIdx]?.items ?? [];

  // ── DRAW ──
  const drawWheel = useCallback((ang) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = canvas.width / 2, cy = canvas.height / 2, r = cx - 4;
    const n = items.length;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (!n) return;
    const arc = (2 * Math.PI) / n;
    items.forEach((item, i) => {
      const start = ang + i * arc - Math.PI / 2;
      const end = start + arc;
      ctx.beginPath(); ctx.moveTo(cx, cy);
      ctx.arc(cx, cy, r, start, end); ctx.closePath();
      ctx.fillStyle = PALETTE[i % PALETTE.length]; ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.5)'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.save();
      ctx.translate(cx, cy); ctx.rotate(start + arc / 2);
      ctx.textAlign = 'right'; ctx.fillStyle = 'white';
      ctx.font = `bold ${Math.min(13, 220 / n)}px Nunito`;
      ctx.shadowColor = 'rgba(0,0,0,.3)'; ctx.shadowBlur = 3;
      ctx.fillText(item.length > 20 ? item.slice(0, 19) + '…' : item, r - 10, 4);
      ctx.restore();
    });
    ctx.beginPath(); ctx.arc(cx, cy, 9, 0, 2 * Math.PI);
    ctx.fillStyle = 'rgba(255,255,255,.9)'; ctx.fill();
  }, [items]);

  useEffect(() => {
    angleRef.current = 0;
    drawWheel(0);
    setLastResult(null);
  }, [activeIdx, drawWheel]);

  // ── SPIN ──
  function spin() {
    // #6 — shake if too few items
    if (items.length < 2) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }
    if (spinning) return;
    setSpinning(true);
    setLastResult(null);
    const target = angleRef.current + (5 + Math.random() * 5) * 2 * Math.PI;
    const dur = 3500 + Math.random() * 1500;
    const t0 = performance.now();
    const a0 = angleRef.current;
    const ease = t => 1 - Math.pow(1 - t, 4);
    function frame(now) {
      const t = Math.min((now - t0) / dur, 1);
      const ang = a0 + ease(t) * (target - a0);
      angleRef.current = ang;
      drawWheel(ang);
      if (t < 1) { rafRef.current = requestAnimationFrame(frame); return; }
      angleRef.current = target % (2 * Math.PI);
      setSpinning(false);
      const arc = (2 * Math.PI) / items.length;
      const norm = ((-angleRef.current % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
      const idx = Math.floor(norm / arc) % items.length;
      setLastResult(items[idx]); // #4 persistent result
    }
    rafRef.current = requestAnimationFrame(frame);
  }

  // ── ITEMS ──
  function addItem() {
    const val = newItem.trim();
    if (!val) return;
    setWheels(ws => ws.map((w, i) => i === activeIdx ? { ...w, items: [...w.items, val] } : w));
    setNewItem('');
  }

  function deleteItem(idx) {
    setWheels(ws => ws.map((w, i) => i === activeIdx ? { ...w, items: w.items.filter((_, j) => j !== idx) } : w));
  }

  // #2 inline edit
  function startEdit(idx) {
    setEditingIdx(idx);
    setEditingVal(items[idx]);
    setTimeout(() => editInputRef.current?.focus(), 30);
  }
  function commitEdit(idx) {
    const val = editingVal.trim();
    if (val) {
      setWheels(ws => ws.map((w, i) => i === activeIdx
        ? { ...w, items: w.items.map((it, j) => j === idx ? val : it) }
        : w));
    }
    setEditingIdx(null);
  }

  // #5 reorder
  const dragHandlers = useDrag(items, (next) => {
    setWheels(ws => ws.map((w, i) => i === activeIdx ? { ...w, items: next } : w));
  });

  // shuffle
  function shuffle() {
    const next = [...items].sort(() => Math.random() - 0.5);
    setWheels(ws => ws.map((w, i) => i === activeIdx ? { ...w, items: next } : w));
  }

  // ── MODAL ──
  function openCreate() { setModal({ open: true, mode: 'create', value: '' }); }
  function openEdit() { setModal({ open: true, mode: 'edit', value: wheels[activeIdx].name }); }
  function closeModal() { setModal(m => ({ ...m, open: false })); }

  function confirmModal() {
    const name = modal.value.trim();
    if (!name) return;
    if (modal.mode === 'create') {
      // #1 empty state — start with no placeholder items
      setWheels(ws => [...ws, { name, items: [] }]);
      setActiveIdx(wheels.length);
      setTimeout(() => drawerRef.current?.scrollTo({ left: 9999, behavior: 'smooth' }), 80);
    } else {
      setWheels(ws => ws.map((w, i) => i === activeIdx ? { ...w, name } : w));
    }
    closeModal();
  }

  function deleteWheel() {
    if (wheels.length <= 1) return;
    setWheels(ws => ws.filter((_, i) => i !== activeIdx));
    setActiveIdx(idx => Math.max(0, idx - 1));
    closeModal();
  }

  function switchWheel(idx) { if (idx !== activeIdx) setActiveIdx(idx); }

  const tooFew = items.length < 2;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fredoka+One&family=Nunito:wght@400;600;700;800&display=swap');
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { background: #f0f7f2; }
        .sw-wrap {
          font-family: 'Nunito', sans-serif; background: #f0f7f2;
          min-height: 100vh; display: flex; flex-direction: column; align-items: center;
          padding-bottom: 80px; color: #1a2e22;
        }
        /* header */
        .sw-header {
          width: 100%; max-width: 480px;
          background: linear-gradient(135deg,#1a2e22 0%,#2d5a3d 100%);
          position: sticky; top: 0; z-index: 20;
          box-shadow: 0 4px 20px rgba(26,46,34,.3);
        }
        .sw-topbar { display: flex; align-items: center; gap: 10px; padding: 10px 16px; overflow: hidden; }
        .sw-btn-new {
          flex-shrink: 0; display: flex; align-items: center; gap: 5px;
          background: #3db86b; color: white; border: none; border-radius: 20px;
          padding: 7px 14px; font-family: 'Fredoka One', sans-serif; font-size: 14px;
          cursor: pointer; white-space: nowrap; transition: background .15s;
        }
        .sw-btn-new:hover { background: #2d9456; }
        .sw-drawer { display: flex; gap: 10px; flex: 1; overflow-x: auto; scrollbar-width: none; align-items: center; padding: 4px 0; }
        .sw-drawer::-webkit-scrollbar { display: none; }
        .sw-chip { display: flex; flex-direction: column; align-items: center; gap: 4px; cursor: pointer; flex-shrink: 0; position: relative; }
        .sw-swatch {
          width: 42px; height: 42px; border-radius: 50%;
          border: 2.5px solid transparent; opacity: .6;
          transition: opacity .15s, transform .15s, border-color .15s;
        }
        .sw-chip:hover .sw-swatch { opacity: .85; transform: translateY(-1px); }
        .sw-chip.active .sw-swatch { opacity: 1; border-color: white; box-shadow: 0 0 0 3px rgba(255,255,255,.2); }
        .sw-chip-label { font-size: 10px; font-weight: 700; color: rgba(255,255,255,.6); max-width: 52px; text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sw-chip.active .sw-chip-label { color: white; }
        .sw-edit-badge {
          position: absolute; top: -3px; right: -3px;
          width: 17px; height: 17px; border-radius: 50%;
          background: white; color: #1a2e22; font-size: 9px;
          display: none; align-items: center; justify-content: center;
          border: none; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,.2); font-weight: 900;
        }
        .sw-chip.active .sw-edit-badge { display: flex; }

        /* title */
        .sw-title {
          font-family: 'Nunito', sans-serif; font-weight: 800; font-size: 20px;
          color: #7a9e87; letter-spacing: 2px; text-transform: uppercase;
          text-align: center; margin: 24px 0 4px;
          display: flex; align-items: center; justify-content: center; gap: 8px;
        }
        .sw-title-edit {
          background: none; border: none; color: #b0c8b8; font-size: 14px;
          cursor: pointer; padding: 2px 4px; border-radius: 4px; transition: color .15s;
        }
        .sw-title-edit:hover { color: #7a9e87; }

        /* wheel */
        .sw-wheel-area {
          position: relative; display: flex; align-items: center; justify-content: center;
          width: 310px; height: 310px; margin: 16px auto 0;
        }
        .sw-shadow { position: absolute; inset: 10px; border-radius: 50%; box-shadow: 0 12px 40px rgba(0,0,0,.18); pointer-events: none; }
        .sw-canvas { position: relative; z-index: 1; border-radius: 50%; }
        .sw-pointer {
          position: absolute; top: -4px; left: 50%; transform: translateX(-50%);
          z-index: 5; width: 0; height: 0;
          border-left: 12px solid transparent; border-right: 12px solid transparent;
          border-top: 28px solid #1a2e22;
          filter: drop-shadow(0 2px 4px rgba(0,0,0,.3));
        }

        /* empty state */
        .sw-empty {
          position: absolute; inset: 0; display: flex; flex-direction: column;
          align-items: center; justify-content: center; gap: 8px;
          background: #e8f5ee; border-radius: 50%;
          border: 3px dashed #a8d4b8;
        }
        .sw-empty-icon { font-size: 32px; }
        .sw-empty-text { font-size: 13px; font-weight: 700; color: #7a9e87; text-align: center; padding: 0 30px; }

        /* result banner */
        .sw-result {
          margin: 14px 16px 0; max-width: 448px; width: calc(100% - 32px);
          background: white; border-radius: 14px; border: 2px solid #3db86b;
          padding: 12px 18px; display: flex; align-items: center; gap: 10px;
          animation: sw-pop .3s cubic-bezier(.34,1.56,.64,1);
        }
        @keyframes sw-pop { from { transform: scale(.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
        .sw-result-label { font-size: 11px; font-weight: 800; color: #3db86b; letter-spacing: 1px; text-transform: uppercase; }
        .sw-result-text { font-family: 'Fredoka One', sans-serif; font-size: 20px; color: #1a2e22; }
        .sw-result-clear { margin-left: auto; background: none; border: none; font-size: 16px; color: #ccc; cursor: pointer; transition: color .15s; }
        .sw-result-clear:hover { color: #e8515a; }

        /* spin btn */
        .sw-spin-btn {
          margin: 16px auto 0; display: block;
          background: linear-gradient(135deg,#3db86b 0%,#2d9456 100%);
          color: white; border: none; border-radius: 30px; padding: 15px 44px;
          font-family: 'Fredoka One', sans-serif; font-size: 22px; cursor: pointer;
          box-shadow: 0 6px 24px rgba(61,184,107,.35);
          transition: transform .15s, box-shadow .15s, background .15s;
        }
        .sw-spin-btn:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 30px rgba(61,184,107,.4); }
        .sw-spin-btn:active:not(:disabled) { transform: translateY(0); }
        .sw-spin-btn:disabled { background: #a8d4b8; box-shadow: none; cursor: not-allowed; }
        .sw-spin-btn.shake { animation: sw-shake .4s ease; }
        @keyframes sw-shake {
          0%,100% { transform: translateX(0); }
          20% { transform: translateX(-8px); }
          40% { transform: translateX(8px); }
          60% { transform: translateX(-5px); }
          80% { transform: translateX(5px); }
        }
        .sw-too-few {
          text-align: center; font-size: 13px; font-weight: 700;
          color: #f47c3c; margin-top: 8px; min-height: 18px;
          transition: opacity .2s;
        }

        /* editor */
        .sw-editor {
          background: white; border-radius: 16px; border: 2px solid #d4eadb;
          margin: 14px 16px 0; max-width: 448px; width: calc(100% - 32px); overflow: hidden;
        }
        .sw-editor-head {
          display: flex; align-items: center; justify-content: space-between;
          padding: 10px 14px; border-bottom: 1px solid #eaf4ee;
          font-size: 12px; font-weight: 700; color: #7a9e87;
          letter-spacing: .5px; text-transform: uppercase;
        }
        .sw-shuffle-btn {
          background: none; border: none; font-size: 14px; cursor: pointer;
          color: #b0c8b8; transition: color .15s; padding: 2px 4px; border-radius: 4px;
        }
        .sw-shuffle-btn:hover { color: #3db86b; }
        .sw-items { list-style: none; max-height: 240px; overflow-y: auto; }
        .sw-items::-webkit-scrollbar { width: 4px; }
        .sw-items::-webkit-scrollbar-thumb { background: #d4eadb; border-radius: 4px; }
        .sw-item {
          display: flex; align-items: center; gap: 10px;
          padding: 8px 14px; border-bottom: 1px solid #f3f9f5;
          font-size: 15px; font-weight: 600; transition: background .1s;
          cursor: grab;
        }
        .sw-item:hover { background: #f7fcf9; }
        .sw-item:active { cursor: grabbing; }
        .sw-drag-handle { color: #ccc; font-size: 14px; cursor: grab; user-select: none; flex-shrink: 0; }
        .sw-dot { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
        .sw-item-text { flex: 1; cursor: text; }
        .sw-item-edit-input {
          flex: 1; border: none; border-bottom: 2px solid #3db86b;
          font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 600;
          color: #1a2e22; outline: none; background: transparent; padding: 1px 0;
        }
        .sw-del {
          background: none; border: none; font-size: 16px; color: #ddd;
          cursor: pointer; padding: 2px 6px; border-radius: 4px; line-height: 1; transition: color .15s;
          flex-shrink: 0;
        }
        .sw-del:hover { color: #e8515a; }
        .sw-add-row { display: flex; gap: 8px; padding: 10px 14px; }
        .sw-input {
          flex: 1; border: 1.5px solid #d4eadb; border-radius: 10px;
          padding: 8px 12px; font-family: 'Nunito', sans-serif;
          font-size: 14px; font-weight: 600; outline: none; color: #1a2e22; transition: border-color .15s;
        }
        .sw-input:focus { border-color: #3db86b; }
        .sw-btn-add {
          background: #3db86b; color: white; border: none; border-radius: 10px;
          padding: 8px 16px; font-family: 'Fredoka One', sans-serif; font-size: 15px;
          cursor: pointer; transition: background .15s;
        }
        .sw-btn-add:hover { background: #2d9456; }

        /* modal */
        .sw-overlay {
          position: fixed; inset: 0; background: rgba(0,0,0,.45); z-index: 50;
          display: flex; align-items: center; justify-content: center; padding: 24px;
          opacity: 0; pointer-events: none; transition: opacity .2s;
        }
        .sw-overlay.open { opacity: 1; pointer-events: all; }
        .sw-modal {
          background: white; border-radius: 20px; padding: 28px 24px 24px;
          width: 100%; max-width: 340px; box-shadow: 0 20px 60px rgba(0,0,0,.25);
          transform: translateY(14px); transition: transform .2s;
        }
        .sw-overlay.open .sw-modal { transform: translateY(0); }
        .sw-modal h2 { font-family: 'Fredoka One', sans-serif; font-size: 22px; color: #1a2e22; margin-bottom: 16px; }
        .sw-modal-input {
          width: 100%; border: 2px solid #d4eadb; border-radius: 12px;
          padding: 11px 14px; font-family: 'Nunito', sans-serif; font-size: 15px; font-weight: 600;
          outline: none; color: #1a2e22; margin-bottom: 16px; transition: border-color .15s;
        }
        .sw-modal-input:focus { border-color: #3db86b; }
        .sw-modal-actions { display: flex; gap: 10px; }
        .sw-modal-actions button {
          flex: 1; padding: 11px; border-radius: 12px; border: none;
          font-family: 'Fredoka One', sans-serif; font-size: 16px; cursor: pointer; transition: background .15s;
        }
        .sw-btn-cancel { background: #f0f7f2; color: #7a9e87; }
        .sw-btn-cancel:hover { background: #e0efea; }
        .sw-btn-confirm { background: #3db86b; color: white; }
        .sw-btn-confirm:hover { background: #2d9456; }
        .sw-btn-delete {
          margin-top: 12px; width: 100%; padding: 11px; border-radius: 12px;
          border: 2px solid #fdd; background: #fff5f5; color: #e8515a;
          font-family: 'Fredoka One', sans-serif; font-size: 15px; cursor: pointer; transition: background .15s;
        }
        .sw-btn-delete:hover { background: #ffe4e4; }
      `}</style>

      <div className="sw-wrap">

        {/* HEADER */}
        <div className="sw-header">
          <div className="sw-topbar">
            <div className="sw-drawer" ref={drawerRef}>
              {wheels.map((w, i) => (
                <div key={i} className={`sw-chip${i === activeIdx ? ' active' : ''}`} onClick={() => switchWheel(i)}>
                  <div className="sw-swatch" style={{ background: swatchBg(i) }} />
                  <span className="sw-chip-label">{w.name}</span>
                  <button className="sw-edit-badge" onClick={e => { e.stopPropagation(); openEdit(); }}>✎</button>
                </div>
              ))}
            </div>
            <button className="sw-btn-new" onClick={openCreate}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3.5" strokeLinecap="round">
                <line x1="12" y1="4" x2="12" y2="20"/><line x1="4" y1="12" x2="20" y2="12"/>
              </svg>
              New
            </button>
          </div>
        </div>

        {/* TITLE with edit shortcut (#3) */}
        <div className="sw-title">
          {wheels[activeIdx]?.name}
          <button className="sw-title-edit" onClick={openEdit} title="Edit wheel name">✎</button>
        </div>

        {/* WHEEL */}
        <div className="sw-wheel-area">
          <div className="sw-shadow" />
          {/* #1 empty state */}
          {items.length === 0 && (
            <div className="sw-empty">
              <div className="sw-empty-icon">🎡</div>
              <div className="sw-empty-text">Add items below to get spinning!</div>
            </div>
          )}
          <canvas ref={canvasRef} className="sw-canvas" width={310} height={310} />
          <div className="sw-pointer" />
        </div>

        {/* #4 persistent result */}
        {lastResult && (
          <div className="sw-result">
            <div>
              <div className="sw-result-label">Last spin</div>
              <div className="sw-result-text">🎉 {lastResult}</div>
            </div>
            <button className="sw-result-clear" onClick={() => setLastResult(null)}>×</button>
          </div>
        )}

        {/* SPIN BUTTON + #6 feedback */}
        <button
          className={`sw-spin-btn${shake ? ' shake' : ''}`}
          onClick={spin}
          disabled={spinning}
        >
          {spinning ? 'Spinning…' : 'Spin the Wheel'}
        </button>
        {/* #6 tooltip */}
        <div className="sw-too-few" style={{ opacity: tooFew ? 1 : 0 }}>
          Add at least 2 items to spin
        </div>

        {/* ITEMS EDITOR */}
        <div className="sw-editor">
          <div className="sw-editor-head">
            Items ({items.length})
            {/* #5 shuffle */}
            <button className="sw-shuffle-btn" onClick={shuffle} title="Shuffle order">🔀 Shuffle</button>
          </div>
          <ul className="sw-items">
            {items.map((item, i) => (
              <li key={i} className="sw-item" {...dragHandlers(i)}>
                <span className="sw-drag-handle">⠿</span>
                <span className="sw-dot" style={{ background: PALETTE[i % PALETTE.length] }} />
                {/* #2 inline edit */}
                {editingIdx === i ? (
                  <input
                    ref={editInputRef}
                    className="sw-item-edit-input"
                    value={editingVal}
                    onChange={e => setEditingVal(e.target.value)}
                    onBlur={() => commitEdit(i)}
                    onKeyDown={e => { if (e.key === 'Enter') commitEdit(i); if (e.key === 'Escape') setEditingIdx(null); }}
                  />
                ) : (
                  <span className="sw-item-text" onDoubleClick={() => startEdit(i)} title="Double-click to edit">{item}</span>
                )}
                <button className="sw-del" onClick={() => deleteItem(i)}>×</button>
              </li>
            ))}
          </ul>
          <div className="sw-add-row">
            <input
              className="sw-input"
              value={newItem}
              onChange={e => setNewItem(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && addItem()}
              placeholder="Add new item…"
              maxLength={40}
            />
            <button className="sw-btn-add" onClick={addItem}>Add</button>
          </div>
        </div>

        {/* MODAL */}
        <div className={`sw-overlay${modal.open ? ' open' : ''}`} onClick={e => e.target === e.currentTarget && closeModal()}>
          <div className="sw-modal">
            <h2>{modal.mode === 'create' ? 'New Wheel' : 'Edit Wheel'}</h2>
            <input
              className="sw-modal-input"
              value={modal.value}
              onChange={e => setModal(m => ({ ...m, value: e.target.value }))}
              onKeyDown={e => e.key === 'Enter' && confirmModal()}
              placeholder="Wheel name…"
              maxLength={30}
              autoFocus
            />
            <div className="sw-modal-actions">
              <button className="sw-btn-cancel" onClick={closeModal}>Cancel</button>
              <button className="sw-btn-confirm" onClick={confirmModal}>
                {modal.mode === 'create' ? 'Create' : 'Save'}
              </button>
            </div>
            {modal.mode === 'edit' && wheels.length > 1 && (
              <button className="sw-btn-delete" onClick={deleteWheel}>🗑 Delete this wheel</button>
            )}
          </div>
        </div>

      </div>
    </>
  );
}
