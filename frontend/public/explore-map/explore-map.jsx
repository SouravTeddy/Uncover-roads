// explore-map.jsx — Explore map. TWO distinct concepts, switched via the `demo`
// prop (the host renders a segmented toggle). They never share logic.
//
//  demo="areas"  → AREAS OF INTEREST (no pill selected)
//     • zoom OUT  : areas shown as soft gradient blobs — deep core, fading out,
//                   no hard boundary. Faint name labels.
//     • zoom IN   : a tappable PILL appears on each area.
//     • tap a pill: that area's pins drop onto the map.
//
//  demo="empty"  → EMPTY AREA (a category pill IS selected)
//     • matching pins populate as you pan over the city.
//     • pan to a region with none (the park) → pill pulses red, ✕ bounces,
//       red "no … here" banner.

const { useState, useRef, useEffect, useLayoutEffect, useCallback } = React;

const EX = {
  bg: '#0b0e15', primary: '#d4a853', primaryDk: '#b8893a',
  blue: '#3b82f6', blueDk: '#2f6fe0', red: '#e8615a', green: '#6fb682',
  text1: '#f2ede6', text2: '#a3a0a8', text3: '#6b6a72',
  glass: 'rgba(12,13,17,.82)', border: 'rgba(255,255,255,.09)',
};
const MIN_S = 0.34, MAX_S = 1.9, clamp = (v, a, b) => Math.max(a, Math.min(b, v));

function ExploreMap({ demo = 'areas' }) {
  const wrapRef = useRef(null);
  const [vp, setVp] = useState({ w: 372, h: 786 });
  const [tf, setTf] = useState(null);
  const [selected, setSelected] = useState(null);   // areas demo: tapped area id
  const [tab, setTab] = useState('explore');
  const [hint, setHint] = useState(true);
  const dragRef = useRef(null);

  const W = window.WORLD, NBH = window.NEIGHBORHOODS, ALL = window.POIS, FILTERS = window.FILTERS, CATC = window.CAT_COLOR;
  const EIcon = window.EIcon;
  const isEmpty = demo === 'empty';
  const filter = FILTERS.eateries;

  useLayoutEffect(() => {
    const el = wrapRef.current; if (!el) return;
    const r = el.getBoundingClientRect(); const w = r.width, h = r.height;
    setVp({ w, h });
    if (isEmpty) { const s = 1.05, cx = 285, cy = 870; setTf({ scale: s, tx: w / 2 - cx * s, ty: h / 2 - cy * s }); }
    else { const s = 0.46, cx = 560, cy = 660; setTf({ scale: s, tx: w / 2 - cx * s, ty: h / 2 - cy * s }); }
  }, []);

  const setClampedTf = useCallback((next) => {
    setTf((prev) => {
      const t = typeof next === 'function' ? next(prev) : next;
      const cw = (vp.w / 2 - t.tx) / t.scale, ch = (vp.h / 2 - t.ty) / t.scale, m = 200;
      const ccw = clamp(cw, -m, W.w + m), cch = clamp(ch, -m, W.h + m);
      return { scale: t.scale, tx: vp.w / 2 - ccw * t.scale, ty: vp.h / 2 - cch * t.scale };
    });
  }, [vp.w, vp.h, W.w, W.h]);

  const zoomAround = useCallback((factor, px, py) => {
    setHint(false);
    setClampedTf((prev) => {
      const ns = clamp(prev.scale * factor, MIN_S, MAX_S);
      const wx = (px - prev.tx) / prev.scale, wy = (py - prev.ty) / prev.scale;
      return { scale: ns, tx: px - wx * ns, ty: py - wy * ns };
    });
  }, [setClampedTf]);

  function onDown(e) { if (e.button != null && e.button !== 0) return; dragRef.current = { x: e.clientX, y: e.clientY, tx: tf.tx, ty: tf.ty }; e.currentTarget.setPointerCapture?.(e.pointerId); }
  function onMove(e) { const d = dragRef.current; if (!d) return; const dx = e.clientX - d.x, dy = e.clientY - d.y; if (Math.abs(dx) + Math.abs(dy) > 3) setHint(false); setClampedTf((p) => ({ scale: p.scale, tx: d.tx + dx, ty: d.ty + dy })); }
  function onUp(e) { dragRef.current = null; e.currentTarget.releasePointerCapture?.(e.pointerId); }
  function onWheel(e) { e.preventDefault(); const r = wrapRef.current.getBoundingClientRect(); zoomAround(Math.exp(-e.deltaY * 0.0014), e.clientX - r.left, e.clientY - r.top); }

  function focusArea(n) {
    setHint(false);
    if (selected === n.id) { setSelected(null); return; }
    setSelected(n.id);
    const s = Math.max(scale, 1.3);
    setClampedTf({ scale: s, tx: vp.w / 2 - n.c[0] * s, ty: vp.h * 0.44 - n.c[1] * s });
  }

  if (!tf) return <div ref={wrapRef} style={{ position: 'absolute', inset: 0, background: EX.bg }} />;

  // ── derived ────────────────────────────────────────────────────────────────
  const { scale, tx, ty } = tf;
  const toS = (x, y) => [x * scale + tx, y * scale + ty];
  const inView = (sx, sy, m = 60) => sx >= -m && sx <= vp.w + m && sy >= -m && sy <= vp.h + m;
  const ccw = (vp.w / 2 - tx) / scale, cch = (vp.h / 2 - ty) / scale;
  let active = NBH[0], best = Infinity;
  for (const n of NBH) { const d = (n.c[0] - ccw) ** 2 + (n.c[1] - cch) ** 2; if (d < best) { best = d; active = n; } }

  // density (all spots) per area, for blob intensity + pill counts
  const countAll = (id) => ALL.filter((p) => p.hood === id).length;
  const countCat = (id, cat) => ALL.filter((p) => p.hood === id && p.cat === cat).length;
  const maxD = Math.max(...NBH.map((n) => countAll(n.id)));

  // pills appear as you zoom IN (areas demo)
  const pillOp = clamp((scale - 0.66) / (0.92 - 0.66), 0, 1);
  const labelOp = 1 - pillOp;

  // empty-demo state
  const eateriesInView = ALL.map((p) => ({ ...p, s: toS(p.x, p.y) })).filter((p) => p.cat === 'restaurant' && inView(p.s[0], p.s[1]));
  const empty = isEmpty && eateriesInView.length === 0;
  const activeRanked = isEmpty ? ALL.filter((p) => p.hood === active.id && p.cat === 'restaurant').sort((a, b) => b.score - a.score) : [];
  const rankOf = new Map(activeRanked.map((p, i) => [p.id, i + 1]));

  return (
    <div style={{ position: 'absolute', inset: 0, background: EX.bg, overflow: 'hidden', fontFamily: "'DM Sans',sans-serif" }}>
      <div ref={wrapRef} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}
        style={{ position: 'absolute', inset: 0, cursor: dragRef.current ? 'grabbing' : 'grab', touchAction: 'none' }}>

        {/* world: grid + gradient area blobs (no boundaries) */}
        <div style={{ position: 'absolute', top: 0, left: 0, width: W.w, height: W.h, transformOrigin: '0 0', transform: `translate(${tx}px, ${ty}px) scale(${scale})` }}>
          <WorldSVG W={W} NBH={NBH} countAll={countAll} maxD={maxD} EX={EX} dim={isEmpty ? 0.6 : 1} />
        </div>

        {/* overlay (screen-space) */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>

          {/* ── AREAS DEMO ── */}
          {!isEmpty && NBH.map((n) => {
            const [cx, cy] = toS(n.c[0], n.c[1]);
            if (!inView(cx, cy, 120)) return null;
            const isSel = selected === n.id;
            const col = n.park ? EX.green : EX.primary;
            return (
              <React.Fragment key={n.id}>
                {/* faint name when zoomed out */}
                {labelOp > 0.04 && !isSel && (
                  <div style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%,-50%)', textAlign: 'center', opacity: labelOp, whiteSpace: 'nowrap' }}>
                    <div style={{ fontSize: 11, fontWeight: 800, letterSpacing: '.16em', textTransform: 'uppercase', color: col, textShadow: '0 1px 10px rgba(0,0,0,.9)' }}>{n.name}</div>
                    <div style={{ fontSize: 9, fontWeight: 600, color: 'rgba(242,237,230,.5)', marginTop: 2, letterSpacing: '.08em' }}>{countAll(n.id)} spots</div>
                  </div>
                )}
                {/* tappable pill when zoomed in */}
                {pillOp > 0.04 && (
                  <button onPointerDown={(e) => e.stopPropagation()} onClick={() => focusArea(n)}
                    style={{ position: 'absolute', left: cx, top: cy, transform: 'translate(-50%,-50%)', opacity: isSel ? 1 : pillOp, pointerEvents: 'auto',
                      display: 'flex', alignItems: 'center', gap: 8, padding: '7px 13px 7px 9px', borderRadius: 999, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: isSel ? `linear-gradient(135deg, ${col}, ${n.park ? '#4f8a62' : EX.primaryDk})` : 'rgba(12,13,17,.9)',
                      backdropFilter: 'blur(14px)', border: `1.5px solid ${isSel ? col : col + '88'}`,
                      boxShadow: isSel ? `0 8px 26px ${col}66, 0 0 22px ${col}44` : '0 6px 20px rgba(0,0,0,.5)' }}>
                    <span style={{ display: 'flex', width: 24, height: 24, borderRadius: '50%', alignItems: 'center', justifyContent: 'center',
                      background: isSel ? 'rgba(12,13,17,.18)' : col + '22', border: `1px solid ${isSel ? 'rgba(12,13,17,.2)' : col + '44'}` }}>
                      <EIcon name={n.park ? 'park' : 'place'} size={14} color={isSel ? '#0c0c0e' : col} fill />
                    </span>
                    <span style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.15, alignItems: 'flex-start' }}>
                      <span style={{ fontSize: 12.5, fontWeight: 700, color: isSel ? '#0c0c0e' : EX.text1 }}>{n.name}</span>
                      <span style={{ fontSize: 9.5, fontWeight: 600, color: isSel ? 'rgba(12,13,17,.66)' : EX.text2 }}>{countAll(n.id)} spots</span>
                    </span>
                  </button>
                )}
                {/* pins for the selected area */}
                {isSel && ALL.filter((p) => p.hood === n.id).map((p, i) => {
                  const [sx, sy] = toS(p.x, p.y);
                  return (
                    <div key={p.id} style={{ position: 'absolute', left: sx, top: sy, transform: 'translate(-50%,-50%)', zIndex: 20 }}>
                      <Marker label={p.name} color={CATC[p.cat]} cat={p.cat} delay={i * 0.05} EIcon={EIcon} />
                    </div>
                  );
                })}
              </React.Fragment>
            );
          })}

          {/* ── EMPTY DEMO ── pins populate; ghosts for context ── */}
          {isEmpty && ALL.map((p) => {
            const [sx, sy] = toS(p.x, p.y);
            if (!inView(sx, sy)) return null;
            if (p.cat === 'restaurant') {
              const rank = rankOf.get(p.id), isActive = p.hood === active.id;
              if (isActive) {
                const first = rank === 1, sz = first ? 36 : 30;
                return (
                  <div key={p.id} style={{ position: 'absolute', left: sx, top: sy, transform: 'translate(-50%,-50%)', zIndex: first ? 30 : 22 }}>
                    <div style={{ width: sz, height: sz, borderRadius: '50%', background: first ? EX.blue : EX.blueDk, color: '#fff', fontWeight: 800, fontSize: first ? 15 : 13,
                      border: `2.5px solid ${first ? '#cfe0ff' : 'rgba(207,224,255,.6)'}`, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      boxShadow: `0 4px 16px ${EX.blue}66, 0 0 0 ${first ? 6 : 0}px rgba(59,130,246,.14)`, animation: 'pinPop .42s cubic-bezier(.34,1.56,.64,1) both' }}>{rank}</div>
                  </div>
                );
              }
              return (
                <div key={p.id} style={{ position: 'absolute', left: sx, top: sy, transform: 'translate(-50%,-50%)', zIndex: 14 }}>
                  <Dot color={CATC.restaurant} cat="restaurant" EIcon={EIcon} />
                </div>
              );
            }
            // non-eateries → ghosted context
            return (
              <div key={p.id} style={{ position: 'absolute', left: sx, top: sy, transform: 'translate(-50%,-50%)', opacity: 0.5, zIndex: 10 }}>
                <Dot color="rgba(242,237,230,.4)" cat={p.cat} ghost EIcon={EIcon} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── chrome ── */}
      <Header EX={EX} />
      {isEmpty && <FilterPill EX={EX} filter={filter} empty={empty} EIcon={EIcon} />}
      <ZoomCtrls EX={EX} EIcon={EIcon} onIn={() => zoomAround(1.4, vp.w / 2, vp.h / 2)} onOut={() => zoomAround(1 / 1.4, vp.w / 2, vp.h / 2)} />

      {hint && !isEmpty && (
        <div style={{ position: 'absolute', top: 150, left: 0, right: 0, textAlign: 'center', pointerEvents: 'none', zIndex: 40, animation: 'fadeIn .8s ease both' }}>
          <span style={{ fontFamily: "'Cormorant Garamond',serif", fontStyle: 'italic', fontSize: 16, color: 'rgba(242,237,230,.72)', textShadow: '0 1px 12px rgba(0,0,0,.9)' }}>
            {pillOp > 0.5 ? 'Tap an area to drop its spots' : 'Zoom in to reveal areas of interest'}
          </span>
        </div>
      )}

      {/* ── bottom ── */}
      {isEmpty
        ? (empty
            ? <EmptyBanner EX={EX} short={filter.short} EIcon={EIcon} />
            : <ResultStrip EX={EX} name={active.name} count={countCat(active.id, 'restaurant')} label="eateries" park={active.park} EIcon={EIcon} />)
        : (selected
            ? <ResultStrip EX={EX} name={NBH.find(n => n.id === selected).name} count={countAll(selected)} label="spots" park={NBH.find(n => n.id === selected).park} EIcon={EIcon} />
            : null)}

      <BottomNav EX={EX} EIcon={EIcon} tab={tab} setTab={setTab} />
    </div>
  );
}

// ── World: grid + soft gradient area blobs (no boundaries) ─────────────────────
function WorldSVG({ W, NBH, countAll, maxD, EX, dim }) {
  const grid = [];
  for (let x = 0; x <= W.w; x += 100) grid.push(<line key={'vx' + x} x1={x} y1={0} x2={x} y2={W.h} stroke="rgba(255,255,255,.04)" strokeWidth={1} />);
  for (let y = 0; y <= W.h; y += 100) grid.push(<line key={'hy' + y} x1={0} y1={y} x2={W.w} y2={y} stroke="rgba(255,255,255,.04)" strokeWidth={1} />);
  return (
    <svg width={W.w} height={W.h} style={{ display: 'block' }}>
      <defs>
        {NBH.map((n) => {
          const dens = countAll(n.id) / maxD;            // 0..1
          const core = n.park ? `rgba(95,165,112,${(0.30 + 0.14 * dens) * dim})` : `rgba(214,170,86,${(0.26 + 0.16 * dens) * dim})`;
          const mid = n.park ? `rgba(95,165,112,${0.10 * dim})` : `rgba(214,170,86,${0.09 * dim})`;
          return (
            <radialGradient key={n.id} id={'blob_' + n.id} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={core} />
              <stop offset="48%" stopColor={mid} />
              <stop offset="100%" stopColor={n.park ? 'rgba(95,165,112,0)' : 'rgba(214,170,86,0)'} />
            </radialGradient>
          );
        })}
      </defs>
      <rect x={0} y={0} width={W.w} height={W.h} fill="#0b0e15" />
      {grid}
      {NBH.map((n) => {
        const rr = n.r * (1.5 + 0.5 * (countAll(n.id) / maxD));
        return <ellipse key={n.id} cx={n.c[0]} cy={n.c[1]} rx={rr} ry={rr * 0.88} fill={`url(#blob_${n.id})`} />;
      })}
    </svg>
  );
}

// ── Markers ────────────────────────────────────────────────────────────────────
function Marker({ label, color, cat, delay, EIcon }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', opacity: 1, animation: `pinDrop .5s cubic-bezier(.34,1.56,.64,1) ${delay}s backwards` }}>
      <div style={{ padding: '3px 9px', borderRadius: 999, marginBottom: 5, whiteSpace: 'nowrap',
        background: 'rgba(10,11,16,.96)', border: `1px solid ${color}66`, boxShadow: '0 4px 14px rgba(0,0,0,.6)',
        fontSize: 10.5, fontWeight: 600, color: EX.text1 }}>{label}</div>
      <Dot color={color} cat={cat} EIcon={EIcon} />
    </div>
  );
}
const EX_T1 = '#f2ede6';
function Dot({ color, cat, ghost = false, EIcon }) {
  const sz = 30;
  return (
    <div style={{ position: 'relative', width: sz, height: sz }}>
      <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', background: 'rgba(14,16,22,.94)',
        border: `1.5px solid ${ghost ? 'rgba(242,237,230,.24)' : color}`, boxShadow: ghost ? 'none' : `0 3px 12px ${color}55`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', backdropFilter: 'blur(4px)' }}>
        <EIcon name={cat} size={15} color={ghost ? 'rgba(242,237,230,.45)' : color} fill={!ghost} />
      </div>
    </div>
  );
}

function Header({ EX }) {
  return (
    <div style={{ position: 'absolute', top: 52, left: 18, right: 18, zIndex: 50, pointerEvents: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 30, color: EX.primary, textShadow: '0 2px 14px rgba(0,0,0,.7)', lineHeight: 1 }}>Tokyo</span>
      <span style={{ fontSize: 12, fontWeight: 600, color: EX.text2, textShadow: '0 1px 8px rgba(0,0,0,.8)' }}>May 15 – May 19</span>
    </div>
  );
}

function FilterPill({ EX, filter, empty, EIcon }) {
  const c = empty ? EX.red : EX.primary;
  return (
    <div style={{ position: 'absolute', top: 92, left: 18, zIndex: 50, display: 'flex', alignItems: 'center', gap: 9, padding: '9px 12px 9px 15px', borderRadius: 999,
      background: empty ? 'rgba(232,97,90,.14)' : 'rgba(212,168,83,.13)', backdropFilter: 'blur(14px)', border: `1.5px solid ${c}`,
      animation: empty ? 'pillPulse 1.3s ease-in-out infinite' : 'none' }}>
      <EIcon name={filter.icon} size={16} color={c} fill />
      <span style={{ fontSize: 14, fontWeight: 700, color: c }}>{filter.label}</span>
      <span style={{ display: 'flex', padding: 2, animation: empty ? 'xBounce 1s ease-in-out infinite' : 'none' }}><EIcon name="close" size={15} color={c} /></span>
    </div>
  );
}

function ZoomCtrls({ EX, onIn, onOut, EIcon }) {
  return (
    <div style={{ position: 'absolute', top: 92, right: 18, zIndex: 50, display: 'flex', flexDirection: 'column', borderRadius: 13, overflow: 'hidden', boxShadow: '0 8px 24px rgba(0,0,0,.45)' }}>
      {[['add', onIn], ['remove', onOut]].map(([ic, fn], i) => (
        <button key={ic} onClick={fn} style={{ width: 38, height: 38, cursor: 'pointer', background: EX.glass, backdropFilter: 'blur(14px)',
          border: `1px solid ${EX.border}`, borderTop: i ? 'none' : `1px solid ${EX.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <EIcon name={ic} size={18} color={EX.text1} />
        </button>
      ))}
    </div>
  );
}

function ResultStrip({ EX, name, count, label, park, EIcon }) {
  return (
    <div style={{ position: 'absolute', left: '50%', bottom: 92, transform: 'translateX(-50%)', zIndex: 50, display: 'flex', alignItems: 'center', gap: 9,
      padding: '9px 16px 9px 13px', borderRadius: 999, whiteSpace: 'nowrap', background: 'rgba(12,13,17,.92)', backdropFilter: 'blur(18px)',
      border: `1px solid ${EX.border}`, boxShadow: '0 10px 32px rgba(0,0,0,.5)', animation: 'stripIn .4s cubic-bezier(.25,0,0,1) both' }}>
      <EIcon name="place" size={16} color={park ? EX.green : EX.primary} fill />
      <span style={{ fontFamily: "'Cormorant Garamond',serif", fontWeight: 700, fontSize: 17, color: EX.text1 }}>{name}</span>
      <span style={{ width: 4, height: 4, borderRadius: '50%', background: EX.text3 }} />
      <span style={{ fontSize: 12.5, fontWeight: 600, color: EX.text2 }}>{count} {label}</span>
    </div>
  );
}

function EmptyBanner({ EX, short, EIcon }) {
  return (
    <div style={{ position: 'absolute', left: 16, right: 16, bottom: 92, zIndex: 55, display: 'flex', alignItems: 'center', gap: 12, padding: '13px 16px', borderRadius: 16,
      background: 'rgba(12,13,17,.94)', backdropFilter: 'blur(16px)', border: '1.5px solid rgba(232,97,90,.6)',
      boxShadow: '0 12px 36px rgba(0,0,0,.6), 0 0 22px rgba(232,97,90,.16)', animation: 'bannerIn .4s cubic-bezier(.25,0,0,1) both' }}>
      <div style={{ width: 38, height: 38, borderRadius: 11, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(232,97,90,.16)', border: '1px solid rgba(232,97,90,.4)' }}>
        <EIcon name="search" size={19} color={EX.red} />
      </div>
      <div style={{ lineHeight: 1.3 }}>
        <div style={{ fontSize: 14.5, fontWeight: 800, color: EX.red }}>No {short} here</div>
        <div style={{ fontSize: 11.5, fontWeight: 500, color: 'rgba(242,237,230,.6)', marginTop: 1 }}>Pan back toward the city to populate spots</div>
      </div>
    </div>
  );
}

function BottomNav({ EX, EIcon, tab, setTab }) {
  const items = [['explore', 'explore', 'Explore'], ['itinerary', 'route', 'Itinerary'], ['profile', 'person', 'Profile']];
  return (
    <div style={{ position: 'absolute', left: 14, right: 14, bottom: 22, zIndex: 60, height: 62, display: 'flex', alignItems: 'center', justifyContent: 'space-around',
      borderRadius: 22, background: 'rgba(12,13,17,.95)', backdropFilter: 'blur(22px)', border: `1px solid ${EX.border}`, boxShadow: '0 -6px 30px rgba(0,0,0,.5)' }}>
      {items.map(([id, ic, label]) => {
        const a = id === tab;
        return (
          <button key={id} onClick={() => setTab(id)} style={{ border: 'none', background: a ? 'rgba(212,168,83,.12)' : 'transparent', cursor: 'pointer',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: '6px 16px', borderRadius: 14 }}>
            <EIcon name={ic} size={21} color={a ? EX.primary : EX.text3} fill={a} />
            <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: a ? EX.primary : EX.text3 }}>{label}</span>
          </button>
        );
      })}
    </div>
  );
}

window.ExploreMap = ExploreMap;
