import { useEffect, useState, useCallback } from 'react';
import { useAppStore } from '../../../shared/store';
import type { ReelTransitCard } from './types';

interface Props { card: ReelTransitCard; active: boolean }

function fmtDur(m: number): string {
  const h = Math.floor(m / 60);
  const min = m % 60;
  if (h === 0) return `${min}m`;
  if (min === 0) return `${h}h`;
  return `${h}h ${min}m`;
}

function parseDepArr(dep: string, arr: string): number | null {
  const [dh, dm] = dep.split(':').map(Number);
  const [ah, am] = arr.split(':').map(Number);
  if ([dh, dm, ah, am].some(isNaN)) return null;
  let diff = (ah * 60 + am) - (dh * 60 + dm);
  if (diff < 0) diff += 24 * 60;
  return diff;
}

// ── Deterministic star positions (seeded by index) ───────────
function star(i: number, count: number) {
  const x = ((i * 127 + 31) % 100);
  const y = ((i * 83 + 17) % 55);
  const size = (i % 3 === 0) ? 2 : (i % 3 === 1) ? 1.5 : 1;
  const dur = 2 + (i % 4) * 0.7;
  const delay = (i * 0.4) % 3;
  return { x, y, size, dur, delay, key: `s${i}${count}` };
}

// ── Train scene ───────────────────────────────────────────────
function TrainScene({ on }: { on: boolean }) {
  const stars = Array.from({ length: 10 }, (_, i) => star(i, 10));
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #0a0e1c 0%, #1c1f3a 30%, #3d2a2a 55%, #2a1612 75%, #0c0c0e 100%)', overflow: 'hidden' }}>
      {/* Stars */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '55%' }} viewBox="0 0 100 55" preserveAspectRatio="none">
        {stars.map(s => (
          <circle key={s.key} cx={s.x} cy={s.y} r={s.size * 0.3}
            fill="rgba(255,255,255,.8)"
            style={{ animation: `twinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }} />
        ))}
      </svg>
      {/* Moon */}
      <div style={{
        position: 'absolute', right: '18%', top: '12%',
        width: 46, height: 46, borderRadius: '50%',
        background: 'radial-gradient(circle at 35% 35%, #f5e8c0, #d4a853 60%, #b8893a)',
        boxShadow: '0 0 28px 8px rgba(212,168,83,.22)',
        opacity: on ? 1 : 0, transition: 'opacity .8s .2s ease',
      }} />
      {/* Far mountains parallax */}
      <div style={{ position: 'absolute', top: '40%', left: 0, width: '200%', height: '30%', willChange: 'transform', animation: on ? 'par 70s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 120" preserveAspectRatio="none">
          <polygon points="0,120 60,40 120,75 200,20 280,65 360,10 440,55 520,25 600,70 680,35 760,60 800,120" fill="rgba(40,45,80,.7)" />
          <polygon points="0,120 60,40 120,75 200,20 280,65 360,10 440,55 520,25 600,70 680,35 760,60 800,120" fill="rgba(40,45,80,.7)" transform="translate(400,0)" />
        </svg>
      </div>
      {/* Mid hills parallax */}
      <div style={{ position: 'absolute', top: '52%', left: 0, width: '200%', height: '20%', willChange: 'transform', animation: on ? 'par 28s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 80" preserveAspectRatio="none">
          <polygon points="0,80 80,30 160,55 240,15 320,48 400,22 480,52 560,28 640,60 720,35 800,80" fill="rgba(55,25,20,.85)" />
          <polygon points="0,80 80,30 160,55 240,15 320,48 400,22 480,52 560,28 640,60 720,35 800,80" fill="rgba(55,25,20,.85)" transform="translate(400,0)" />
        </svg>
      </div>
      {/* Track surface */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '28%', background: 'linear-gradient(to bottom, transparent, #0c0c0e 60%)' }} />
      {/* Track ties (animated) */}
      <div style={{
        position: 'absolute', bottom: '12%', left: 0, width: '100%', height: 8,
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(80,60,50,.6) 0px, rgba(80,60,50,.6) 16px, transparent 16px, transparent 30px)',
        backgroundSize: '120px 8px',
        animation: on ? 'tickFast 0.45s steps(1) infinite' : 'none',
      }} />
      {/* Rails */}
      <div style={{ position: 'absolute', bottom: '11%', left: 0, right: 0, height: 2, background: 'rgba(160,140,120,.35)' }} />
      <div style={{ position: 'absolute', bottom: '14%', left: 0, right: 0, height: 2, background: 'rgba(160,140,120,.35)' }} />
      {/* Telephone poles parallax */}
      <div style={{ position: 'absolute', top: '25%', left: 0, width: '200%', height: '50%', willChange: 'transform', animation: on ? 'par 3.2s linear infinite' : 'none', pointerEvents: 'none' }}>
        {[0, 1, 2, 3, 4, 5, 6, 7].map(i => (
          <div key={i} style={{ position: 'absolute', left: `${i * 12.5}%`, top: 0, width: 2, height: '100%', background: 'rgba(40,35,30,.7)' }}>
            <div style={{ position: 'absolute', top: '10%', left: -8, width: 18, height: 2, background: 'rgba(40,35,30,.6)' }} />
            <div style={{ position: 'absolute', top: '22%', left: -6, width: 14, height: 2, background: 'rgba(40,35,30,.5)' }} />
          </div>
        ))}
      </div>
      {/* Shinkansen SVG */}
      <div style={{ position: 'absolute', top: '58%', left: '50%', transform: 'translate(-50%, 0)', width: 220, opacity: on ? 1 : 0, transition: 'opacity .5s .4s ease' }}>
        <svg viewBox="0 0 220 60" width="220" height="60">
          <ellipse cx="40" cy="32" rx="40" ry="14" fill="#e8e0d8" />
          <rect x="38" y="18" width="160" height="28" rx="4" fill="#e8e0d8" />
          <rect x="60" y="20" width="130" height="8" rx="2" fill="rgba(74,127,160,.6)" />
          <rect x="60" y="30" width="130" height="12" rx="0" fill="#d0c8c0" />
          <circle cx="70" cy="46" r="7" fill="#555" /><circle cx="70" cy="46" r="3" fill="#222" />
          <circle cx="140" cy="46" r="7" fill="#555" /><circle cx="140" cy="46" r="3" fill="#222" />
          <circle cx="195" cy="46" r="7" fill="#555" /><circle cx="195" cy="46" r="3" fill="#222" />
          <line x1="38" y1="24" x2="38" y2="46" stroke="#4a7fa0" strokeWidth="2" />
          {[0,1,2,3].map(i => <rect key={i} x={75 + i * 32} y={22} width={18} height={16} rx="1" fill="rgba(200,230,255,.25)" stroke="rgba(255,255,255,.1)" strokeWidth=".5" />)}
        </svg>
      </div>
      {/* Speed lines */}
      {[0, 1, 2].map(i => (
        <div key={i} style={{
          position: 'absolute', left: 0, right: 0,
          top: `${56 + i * 4}%`, height: 1,
          background: `rgba(255,255,255,${0.05 - i * 0.01})`,
          animation: on ? `speedLine ${1.8 + i * 0.4}s ${i * 0.3}s ease-in-out infinite` : 'none',
        }} />
      ))}
    </div>
  );
}

// ── Flight scene ──────────────────────────────────────────────
function FlightScene({ on }: { on: boolean }) {
  const stars = Array.from({ length: 22 }, (_, i) => star(i, 22));
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #0c1430 0%, #1c2552 15%, #3a3766 28%, #6e4a6e 42%, #c47a5e 58%, #e8a06a 70%, #2a1a14 100%)', overflow: 'hidden' }}>
      {/* Stars */}
      <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '45%' }} viewBox="0 0 100 45" preserveAspectRatio="none">
        {stars.map(s => (
          <circle key={s.key} cx={s.x} cy={s.y * 0.8} r={s.size * 0.25}
            fill="rgba(255,255,255,.7)"
            style={{ animation: `twinkle ${s.dur}s ${s.delay}s ease-in-out infinite` }} />
        ))}
      </svg>
      {/* Sun on horizon */}
      <div style={{
        position: 'absolute', right: '14%', top: '68%',
        width: 52, height: 52, borderRadius: '50%',
        background: 'radial-gradient(circle, #fff5e0 0%, #f5c070 40%, #e8803a 70%)',
        boxShadow: '0 0 60px 20px rgba(232,128,58,.35)',
        opacity: on ? 1 : 0, transition: 'opacity 1s .3s ease',
      }} />
      {/* Horizon haze */}
      <div style={{ position: 'absolute', top: '62%', left: 0, right: 0, height: '12%', background: 'linear-gradient(to bottom, transparent, rgba(232,160,106,.18), transparent)' }} />
      {/* Cirrus clouds */}
      <div style={{ position: 'absolute', top: '18%', left: 0, width: '200%', height: '8%', willChange: 'transform', animation: on ? 'par 90s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 40" preserveAspectRatio="none">
          {[0,1,2,3,4,5].map(i => (
            <ellipse key={i} cx={80 + i * 130} cy={20} rx={55 + (i%3)*15} ry={6} fill="rgba(255,255,255,.07)" />
          ))}
          {[0,1,2,3,4,5].map(i => (
            <ellipse key={`r${i}`} cx={80 + i * 130} cy={20} rx={55 + (i%3)*15} ry={6} fill="rgba(255,255,255,.07)" transform="translate(400,0)" />
          ))}
        </svg>
      </div>
      {/* Mid clouds */}
      <div style={{ position: 'absolute', top: '55%', left: 0, width: '200%', willChange: 'transform', animation: on ? 'par 26s linear infinite' : 'none' }}>
        <svg width="100%" height="60" viewBox="0 0 800 60" preserveAspectRatio="none">
          {[0,1,2,3].map(i => (
            <ellipse key={i} cx={100 + i * 200} cy={30} rx={80} ry={20} fill="rgba(200,130,90,.14)" />
          ))}
          {[0,1,2,3].map(i => (
            <ellipse key={`r${i}`} cx={100 + i * 200} cy={30} rx={80} ry={20} fill="rgba(200,130,90,.14)" transform="translate(400,0)" />
          ))}
        </svg>
      </div>
      {/* Lower clouds */}
      <div style={{ position: 'absolute', top: '68%', left: 0, width: '200%', willChange: 'transform', animation: on ? 'par 11s linear infinite' : 'none' }}>
        <svg width="100%" height="80" viewBox="0 0 800 80" preserveAspectRatio="none">
          {[0,1,2,3,4].map(i => (
            <ellipse key={i} cx={80 + i * 160} cy={50} rx={70} ry={28} fill="rgba(42,26,20,.55)" />
          ))}
          {[0,1,2,3,4].map(i => (
            <ellipse key={`r${i}`} cx={80 + i * 160} cy={50} rx={70} ry={28} fill="rgba(42,26,20,.55)" transform="translate(400,0)" />
          ))}
        </svg>
      </div>
      {/* Airliner SVG */}
      <div style={{
        position: 'absolute', top: '38%', left: '50%',
        width: 200, height: 60,
        animation: on ? 'planeBob 5s ease-in-out infinite' : 'none',
        opacity: on ? 1 : 0, transition: 'opacity .6s .5s ease',
      }}>
        <svg viewBox="0 0 420 110" width="200" height="60">
          {/* Fuselage */}
          <ellipse cx="210" cy="55" rx="190" ry="18" fill="#dce8f0" />
          {/* Nose */}
          <ellipse cx="25" cy="55" rx="25" ry="14" fill="#c8dce8" />
          {/* Wings */}
          <polygon points="140,55 300,55 260,95 180,95" fill="#b8ccd8" />
          <polygon points="140,55 300,55 260,18 180,18" fill="#b8ccd8" />
          {/* Tail */}
          <polygon points="360,50 400,20 400,55" fill="#c8dce8" />
          <polygon points="360,60 400,90 400,55" fill="#b8ccd8" />
          {/* Windows */}
          {[0,1,2,3,4,5,6,7,8].map(i => (
            <ellipse key={i} cx={60 + i * 28} cy={50} rx={7} ry={6} fill="rgba(180,220,255,.4)" stroke="rgba(255,255,255,.15)" strokeWidth=".5" />
          ))}
          {/* Engine */}
          <ellipse cx="220" cy="80" rx="28" ry="9" fill="#a8bcc8" />
          <ellipse cx="220" cy="20" rx="28" ry="9" fill="#a8bcc8" />
        </svg>
      </div>
      {/* Contrail */}
      <div style={{
        position: 'absolute', top: '41%', left: '55%', right: 0, height: 2,
        background: 'linear-gradient(to right, rgba(255,255,255,.18), transparent)',
        opacity: on ? 1 : 0, transition: 'opacity .8s .8s ease',
      }} />
    </div>
  );
}

// ── Bus scene ─────────────────────────────────────────────────
function BusScene({ on }: { on: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #0c0e18 0%, #2a1f3d 20%, #5a2e2e 45%, #6e3a1e 62%, #1a1208 100%)', overflow: 'hidden' }}>
      {/* Setting sun */}
      <div style={{
        position: 'absolute', left: '20%', top: '60%',
        width: 60, height: 60, borderRadius: '50%',
        background: 'radial-gradient(circle, #fff0c0, #f0a030 50%, #e05020)',
        boxShadow: '0 0 50px 18px rgba(240,100,30,.3)',
        opacity: on ? .8 : 0, transition: 'opacity .8s .2s ease',
      }} />
      {/* City skyline parallax */}
      <div style={{ position: 'absolute', top: '25%', left: 0, width: '200%', height: '50%', willChange: 'transform', animation: on ? 'par 90s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 200" preserveAspectRatio="none">
          {[[20,120,40,200],[80,80,30,200],[130,100,50,200],[200,60,25,200],[240,90,35,200],[300,70,40,200],[360,110,28,200],[410,55,32,200],[460,85,45,200],[530,75,38,200],[580,100,30,200],[640,65,42,200],[700,90,35,200],[750,115,28,200]].map(([x,h,w,bot], i) => (
            <rect key={i} x={x} y={bot-h} width={w} height={h} fill={`rgba(${20+i*2},${15+i},${35+i},0.75)`} />
          ))}
          {[[20,120,40,200],[80,80,30,200],[130,100,50,200],[200,60,25,200],[240,90,35,200],[300,70,40,200],[360,110,28,200],[410,55,32,200],[460,85,45,200],[530,75,38,200],[580,100,30,200],[640,65,42,200],[700,90,35,200],[750,115,28,200]].map(([x,h,w,bot], i) => (
            <rect key={`r${i}`} x={x+400} y={bot-h} width={w} height={h} fill={`rgba(${20+i*2},${15+i},${35+i},0.75)`} />
          ))}
        </svg>
      </div>
      {/* Trees parallax */}
      <div style={{ position: 'absolute', top: '55%', left: 0, width: '200%', height: '25%', willChange: 'transform', animation: on ? 'par 26s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 100" preserveAspectRatio="none">
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(i => (
            <g key={i} transform={`translate(${40 + i * 55},0)`}>
              <rect x={-4} y={60} width={8} height={40} fill="rgba(30,20,10,.8)" />
              <ellipse cx={0} cy={45} rx={22} ry={30} fill="rgba(25,45,20,.75)" />
            </g>
          ))}
          {[0,1,2,3,4,5,6,7,8,9,10,11,12,13].map(i => (
            <g key={`r${i}`} transform={`translate(${440 + i * 55},0)`}>
              <rect x={-4} y={60} width={8} height={40} fill="rgba(30,20,10,.8)" />
              <ellipse cx={0} cy={45} rx={22} ry={30} fill="rgba(25,45,20,.75)" />
            </g>
          ))}
        </svg>
      </div>
      {/* Road surface */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '22%', background: 'linear-gradient(to bottom, #1a1408, #120f06)' }} />
      {/* Road dashes */}
      <div style={{
        position: 'absolute', bottom: '11%', left: 0, width: '100%', height: 5,
        backgroundImage: 'repeating-linear-gradient(90deg, rgba(240,200,80,.45) 0px, rgba(240,200,80,.45) 30px, transparent 30px, transparent 60px)',
        backgroundSize: '120px 5px',
        animation: on ? 'tickFast 0.5s steps(1) infinite' : 'none',
      }} />
      {/* Lampposts parallax */}
      <div style={{ position: 'absolute', top: '40%', left: 0, width: '200%', height: '50%', willChange: 'transform', animation: on ? 'par 4.5s linear infinite' : 'none', pointerEvents: 'none' }}>
        {[0,1,2,3,4,5,6,7].map(i => (
          <div key={i} style={{ position: 'absolute', left: `${i * 12.5}%`, top: 0, width: 3, height: '100%', background: 'rgba(50,40,30,.7)' }}>
            <div style={{ position: 'absolute', top: 0, right: -1, width: 18, height: 3, background: 'rgba(50,40,30,.6)', transform: 'rotate(-8deg)', transformOrigin: 'left center' }} />
            <div style={{ position: 'absolute', top: -2, right: -2, width: 8, height: 8, borderRadius: '50%', background: 'rgba(240,200,80,.5)', boxShadow: '0 0 12px 4px rgba(240,200,80,.3)' }} />
          </div>
        ))}
      </div>
      {/* Bus SVG */}
      <div style={{
        position: 'absolute', bottom: '18%', left: '50%',
        animation: on ? 'busBob 2.2s ease-in-out infinite' : 'none',
        opacity: on ? 1 : 0, transition: 'opacity .5s .4s ease',
        transformOrigin: 'bottom center',
      }}>
        <svg viewBox="0 0 200 90" width="180" height="81">
          {/* Body */}
          <rect x="8" y="10" width="184" height="65" rx="6" fill="#d4a853" />
          <rect x="8" y="10" width="184" height="20" rx="6" fill="#c49838" />
          {/* Windows */}
          {[0,1,2,3,4].map(i => (
            <rect key={i} x={18 + i * 36} y={18} width={28} height={16} rx="2" fill="rgba(180,230,255,.35)" stroke="rgba(255,255,255,.12)" strokeWidth=".5" />
          ))}
          {/* Windshield */}
          <rect x="160" y="18" width="26" height="16" rx="2" fill="rgba(180,230,255,.4)" />
          {/* Door */}
          <rect x="12" y="30" width="18" height="35" rx="1" fill="rgba(0,0,0,.2)" stroke="rgba(255,255,255,.08)" strokeWidth=".5" />
          {/* Undercarriage */}
          <rect x="15" y="72" width="170" height="6" rx="3" fill="#a07828" />
          {/* Wheels */}
          {[38, 152].map(cx => (
            <g key={cx}>
              <circle cx={cx} cy={82} r={12} fill="#222" style={{ animation: on ? `wheelSpin 0.35s linear infinite` : 'none', transformOrigin: `${cx}px 82px` }} />
              <circle cx={cx} cy={82} r={5} fill="#555" />
              {[0,1,2,3].map(s => (
                <line key={s} x1={cx} y1={82} x2={cx + 9 * Math.cos(s * Math.PI / 2)} y2={82 + 9 * Math.sin(s * Math.PI / 2)} stroke="#444" strokeWidth="1.5" />
              ))}
            </g>
          ))}
        </svg>
      </div>
      {/* Headlight glow */}
      <div style={{
        position: 'absolute', bottom: '18%', right: '28%',
        width: 80, height: 30,
        background: 'radial-gradient(ellipse at left, rgba(240,220,120,.25), transparent 70%)',
        opacity: on ? 1 : 0, transition: 'opacity .5s .6s ease',
      }} />
    </div>
  );
}

// ── Ferry scene ───────────────────────────────────────────────
function FerryScene({ on }: { on: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #1a1f3d 0%, #4a2e5e 15%, #8a3f4e 30%, #c46a4e 45%, #d4a853 55%, #6a5a8e 70%, #2a3a5e 82%, #0c1428 100%)', overflow: 'hidden' }}>
      {/* Sun on horizon */}
      <div style={{
        position: 'absolute', left: '50%', top: '52%',
        transform: 'translateX(-50%)',
        width: 70, height: 70, borderRadius: '50%',
        background: 'radial-gradient(circle, #fff8e8 0%, #f5d060 40%, #e8903a 70%)',
        boxShadow: '0 0 80px 30px rgba(232,144,58,.35)',
        opacity: on ? .9 : 0, transition: 'opacity 1s .2s ease',
      }} />
      {/* Sun reflection on water */}
      <div style={{
        position: 'absolute', top: '58%', left: '38%', right: '38%', bottom: '32%',
        background: 'linear-gradient(to bottom, rgba(212,168,83,.25), transparent)',
        opacity: on ? 1 : 0, transition: 'opacity 1s .3s ease',
      }} />
      {/* Harbour silhouette */}
      <div style={{ position: 'absolute', bottom: '28%', left: 0, right: 0, opacity: on ? 1 : 0, transition: 'opacity .8s .4s ease' }}>
        <svg width="100%" height="100" viewBox="0 0 400 100" preserveAspectRatio="none">
          {/* Left buildings */}
          <rect x="0" y="40" width="30" height="60" fill="rgba(10,15,35,.85)" />
          <rect x="32" y="55" width="20" height="45" fill="rgba(10,15,35,.75)" />
          <rect x="55" y="30" width="12" height="70" fill="rgba(10,15,35,.9)" />
          {/* Bridge arch */}
          <path d="M80,100 Q120,40 160,100" fill="none" stroke="rgba(10,15,35,.9)" strokeWidth="5" />
          <line x1="80" y1="60" x2="80" y2="100" stroke="rgba(10,15,35,.8)" strokeWidth="4" />
          <line x1="160" y1="60" x2="160" y2="100" stroke="rgba(10,15,35,.8)" strokeWidth="4" />
          {/* Right buildings */}
          <rect x="220" y="50" width="25" height="50" fill="rgba(10,15,35,.8)" />
          <rect x="250" y="35" width="18" height="65" fill="rgba(10,15,35,.85)" />
          <rect x="280" y="20" width="10" height="80" fill="rgba(10,15,35,.9)" />
          <rect x="300" y="45" width="35" height="55" fill="rgba(10,15,35,.75)" />
          <rect x="340" y="30" width="60" height="70" fill="rgba(10,15,35,.7)" />
        </svg>
      </div>
      {/* Waves — 3 layers */}
      <div style={{ position: 'absolute', top: '58%', left: 0, width: '200%', height: '16%', willChange: 'transform', animation: on ? 'par 18s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 60" preserveAspectRatio="none">
          {[0,1,2,3,4].map(i => <path key={i} d={`M${i*160},30 Q${i*160+40},15 ${i*160+80},30 Q${i*160+120},45 ${i*160+160},30`} fill="none" stroke="rgba(212,168,83,.18)" strokeWidth="2" />)}
          {[0,1,2,3,4].map(i => <path key={`r${i}`} d={`M${400+i*160},30 Q${400+i*160+40},15 ${400+i*160+80},30 Q${400+i*160+120},45 ${400+i*160+160},30`} fill="none" stroke="rgba(212,168,83,.18)" strokeWidth="2" />)}
        </svg>
      </div>
      <div style={{ position: 'absolute', top: '62%', left: 0, width: '200%', height: '14%', willChange: 'transform', animation: on ? 'parRev 11s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 50" preserveAspectRatio="none">
          {[0,1,2,3,4].map(i => <path key={i} d={`M${i*160},25 Q${i*160+40},12 ${i*160+80},25 Q${i*160+120},38 ${i*160+160},25`} fill="none" stroke="rgba(74,90,140,.25)" strokeWidth="2" />)}
          {[0,1,2,3,4].map(i => <path key={`r${i}`} d={`M${400+i*160},25 Q${400+i*160+40},12 ${400+i*160+80},25 Q${400+i*160+120},38 ${400+i*160+160},25`} fill="none" stroke="rgba(74,90,140,.25)" strokeWidth="2" />)}
        </svg>
      </div>
      <div style={{ position: 'absolute', top: '66%', left: 0, width: '200%', height: '12%', willChange: 'transform', animation: on ? 'par 6s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 40" preserveAspectRatio="none">
          {[0,1,2,3,4,5].map(i => <path key={i} d={`M${i*130},20 Q${i*130+32},10 ${i*130+65},20 Q${i*130+98},30 ${i*130+130},20`} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="1.5" />)}
          {[0,1,2,3,4,5].map(i => <path key={`r${i}`} d={`M${400+i*130},20 Q${400+i*130+32},10 ${400+i*130+65},20 Q${400+i*130+98},30 ${400+i*130+130},20`} fill="none" stroke="rgba(255,255,255,.1)" strokeWidth="1.5" />)}
        </svg>
      </div>
      {/* Ferry SVG */}
      <div style={{
        position: 'absolute', bottom: '28%', left: '50%',
        animation: on ? 'ferryBob 4s ease-in-out infinite' : 'none',
        opacity: on ? 1 : 0, transition: 'opacity .6s .5s ease',
      }}>
        <svg viewBox="0 0 240 110" width="210" height="96" style={{ transform: 'translateX(-50%)' }}>
          {/* Hull */}
          <path d="M10,70 L20,95 L220,95 L230,70 Z" fill="#1a3a6a" />
          <path d="M10,70 L230,70 L220,55 L20,55 Z" fill="#2a5a9a" />
          {/* Superstructure */}
          <rect x="50" y="25" width="140" height="30" rx="3" fill="#e8e0d0" />
          <rect x="60" y="15" width="100" height="12" rx="2" fill="#d8cfc0" />
          {/* Windows lower deck */}
          {[0,1,2,3,4,5].map(i => <rect key={i} x={55 + i * 22} y={58} width={14} height={10} rx="1" fill="rgba(180,220,255,.3)" />)}
          {/* Windows upper */}
          {[0,1,2,3,4].map(i => <rect key={i} x={65 + i * 22} y={28} width={14} height={8} rx="1" fill="rgba(180,220,255,.4)" />)}
          {/* Funnel */}
          <rect x="148" y="10" width="14" height="18" rx="3" fill="#c03020" />
          <rect x="146" y="8" width="18" height="5" rx="2" fill="#a02010" />
          {/* Flag */}
          <line x1="162" y1="8" x2="162" y2="0" stroke="#888" strokeWidth="1" />
          <polygon points="162,0 172,3 162,6" fill="#d4a853" />
        </svg>
      </div>
    </div>
  );
}

// ── Drive scene ───────────────────────────────────────────────
function DriveScene({ on }: { on: boolean }) {
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #141820 0%, #2a3040 25%, #4a5038 50%, #3a4028 70%, #1a1a10 100%)', overflow: 'hidden' }}>
      {/* Sky */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(74,90,120,.3) 0%, transparent 50%)' }} />
      {/* Far hills */}
      <div style={{ position: 'absolute', top: '40%', left: 0, width: '200%', height: '25%', willChange: 'transform', animation: on ? 'par 50s linear infinite' : 'none' }}>
        <svg width="100%" height="100%" viewBox="0 0 800 100" preserveAspectRatio="none">
          <polygon points="0,100 100,40 200,70 300,30 400,60 500,20 600,55 700,35 800,100" fill="rgba(45,55,35,.8)" />
          <polygon points="0,100 100,40 200,70 300,30 400,60 500,20 600,55 700,35 800,100" fill="rgba(45,55,35,.8)" transform="translate(400,0)" />
        </svg>
      </div>
      {/* Road */}
      <div style={{ position: 'absolute', bottom: 0, left: '30%', right: '30%', top: '60%', background: 'linear-gradient(to bottom, transparent, #2a2a1e)' }} />
      {/* Road markings */}
      <div style={{
        position: 'absolute', bottom: '5%', left: '49%', width: '2%', top: '65%',
        backgroundImage: 'repeating-linear-gradient(to bottom, rgba(240,220,80,.5) 0px, rgba(240,220,80,.5) 20px, transparent 20px, transparent 40px)',
        animation: on ? 'tickFast 0.6s steps(1) infinite' : 'none',
      }} />
      {/* Car */}
      <div style={{
        position: 'absolute', bottom: '8%', left: '50%',
        transform: 'translateX(-50%)',
        opacity: on ? 1 : 0, transition: 'opacity .5s .4s ease',
      }}>
        <svg viewBox="0 0 180 80" width="160" height="72">
          <path d="M20,50 Q35,25 60,20 L120,20 Q145,25 160,50 L165,65 L15,65 Z" fill="#2a4a7a" />
          <path d="M55,22 L65,10 L115,10 L125,22 Z" fill="#1a3a6a" />
          <rect x="58" y="11" width="64" height="11" rx="1" fill="rgba(180,230,255,.35)" />
          <circle cx="42" cy="66" r="11" fill="#222" /><circle cx="42" cy="66" r="5" fill="#444" />
          <circle cx="138" cy="66" r="11" fill="#222" /><circle cx="138" cy="66" r="5" fill="#444" />
          <rect x="12" y="48" width="18" height="8" rx="2" fill="rgba(240,220,100,.6)" />
          <rect x="150" y="48" width="18" height="8" rx="2" fill="rgba(240,60,60,.5)" />
        </svg>
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────

const MODE_CFG: Record<string, { icon: string; label: string; color: string }> = {
  flight: { icon: 'flight',          label: 'Flight',    color: '#4a7fa0' },
  train:  { icon: 'train',           label: 'Train',     color: '#7c6f9f' },
  drive:  { icon: 'directions_car',  label: 'Drive',     color: '#8b9e6a' },
  bus:    { icon: 'directions_bus',  label: 'Coach',     color: '#c27c4a' },
  ferry:  { icon: 'directions_boat', label: 'Ferry',     color: '#4a7fa0' },
};

export function ReelTransitCard({ card, active }: Props) {
  const { dispatch } = useAppStore();
  const [on, setOn] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [dep, setDep] = useState('');
  const [arr, setArr] = useState('');
  const [ref, setRef] = useState('');
  const cfg = MODE_CFG[card.mode] ?? MODE_CFG.flight;
  const PATH_LEN = 200;
  const isPlaceholder = card.durationMinutes == null && card.distanceKm == null;

  useEffect(() => {
    if (active) {
      const t = setTimeout(() => setOn(true), 100);
      return () => clearTimeout(t);
    } else {
      setOn(false);
    }
  }, [active]);

  const handleSaveDetails = useCallback(() => {
    const dur = parseDepArr(dep, arr);
    if (!dur) return;
    dispatch({
      type: 'SET_TRANSIT_DETAILS',
      from: card.from,
      to: card.to,
      departureTime: dep,
      arrivalTime: arr,
      durationMinutes: dur,
      transitRef: ref || undefined,
    });
    setSheetOpen(false);
  }, [dep, arr, ref, card.from, card.to, dispatch]);

  const fade = (delay: string, extra?: React.CSSProperties): React.CSSProperties => ({
    opacity: on ? 1 : 0,
    transition: `opacity .5s ${delay} ease`,
    ...extra,
  });

  const durationLabel = card.durationMinutes != null ? fmtDur(card.durationMinutes) : null;
  const distanceLabel = card.distanceKm != null ? `${card.distanceKm} km` : null;
  const metaLabel = [durationLabel, distanceLabel].filter(Boolean).join(' · ');

  // Mode emoji icons for placeholder
  const modeEmoji: Record<string, string> = {
    flight: '✈️',
    train: '🚆',
    drive: '🚗',
    bus: '🚌',
    ferry: '⛴️',
  };

  return (
    <div className="reel-card" style={{
      position: 'relative', width: '100%', height: '100dvh', overflow: 'hidden',
    }}>
      {/* Cinematic scene */}
      {!isPlaceholder && card.mode === 'train'  && <TrainScene  on={on} />}
      {!isPlaceholder && card.mode === 'flight' && <FlightScene on={on} />}
      {!isPlaceholder && card.mode === 'bus'    && <BusScene    on={on} />}
      {!isPlaceholder && card.mode === 'ferry'  && <FerryScene  on={on} />}
      {!isPlaceholder && card.mode === 'drive'  && <DriveScene  on={on} />}

      {/* Placeholder background — reuse mode scene colors */}
      {isPlaceholder && (
        <div style={{
          position: 'absolute', inset: 0,
          background: card.mode === 'train' ? 'linear-gradient(to bottom, #0a0e1c 0%, #1c1f3a 30%, #3d2a2a 55%, #2a1612 75%, #0c0c0e 100%)'
            : card.mode === 'flight' ? 'linear-gradient(to bottom, #0c1430 0%, #1c2552 15%, #3a3766 28%, #6e4a6e 42%, #c47a5e 58%, #e8a06a 70%, #2a1a14 100%)'
            : card.mode === 'bus' ? 'linear-gradient(to bottom, #0c0e18 0%, #2a1f3d 20%, #5a2e2e 45%, #6e3a1e 62%, #1a1208 100%)'
            : card.mode === 'ferry' ? 'linear-gradient(to bottom, #1a1f3d 0%, #4a2e5e 15%, #8a3f4e 30%, #c46a4e 45%, #d4a853 55%, #6a5a8e 70%, #2a3a5e 82%, #0c1428 100%)'
            : 'linear-gradient(to bottom, #141820 0%, #2a3040 25%, #4a5038 50%, #3a4028 70%, #1a1a10 100%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          overflow: 'hidden',
        }} />
      )}

      {/* Content gradient overlay */}
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, rgba(0,0,0,.1) 0%, transparent 30%, transparent 50%, rgba(0,0,0,.75) 75%, rgba(0,0,0,.95) 100%)', pointerEvents: 'none' }} />

      {/* Service pill — top center */}
      {card.ref && (
        <div style={{
          position: 'absolute', top: 'calc(env(safe-area-inset-top, 0px) + 14px)', left: '50%', transform: 'translateX(-50%)',
          display: 'inline-flex', alignItems: 'center', gap: 5,
          padding: '4px 10px', borderRadius: 8,
          background: 'rgba(0,0,0,.52)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,.12)',
          ...fade('.3s'),
        }}>
          <span className="ms" style={{ fontSize: 13, color: cfg.color }}>{cfg.icon}</span>
          <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,.85)' }}>{card.ref}</span>
        </div>
      )}

      {/* Bottom content panel */}
      {isPlaceholder ? (
        /* PLACEHOLDER STATE: minimal card for trips without journey data */
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 26px calc(88px + env(safe-area-inset-bottom, 0px))', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'flex-end', height: '100%' }}>
          {/* Mode icon large emoji */}
          <div style={{
            fontSize: 48, marginBottom: 24,
            opacity: on ? 1 : 0,
            transform: on ? 'scale(1)' : 'scale(0.85)',
            transition: 'opacity .5s .2s ease, transform .5s .2s ease',
          }}>
            {modeEmoji[card.mode] || '🚗'}
          </div>

          {/* FROM → TO heading */}
          <h2 style={{
            fontFamily: 'var(--font-heading)', fontSize: 32, fontWeight: 700,
            color: '#f5f0ea', textAlign: 'center', marginBottom: 16,
            opacity: on ? 1 : 0,
            transform: on ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity .5s .3s ease, transform .5s .3s ease',
            lineHeight: 1.1,
          }}>
            {card.from} → {card.to}
          </h2>

          {/* Muted text: Journey details not available */}
          <p style={{
            fontSize: 14, color: '#a09880', textAlign: 'center', marginBottom: 20,
            opacity: on ? 1 : 0,
            transform: on ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity .5s .4s ease, transform .5s .4s ease',
          }}>
            Journey details not yet available
          </p>

          {/* Mode badge chip */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 16px', borderRadius: 20,
            background: 'rgba(212,168,83,.08)', border: '1px solid rgba(212,168,83,.24)',
            backdropFilter: 'blur(8px)',
            opacity: on ? 1 : 0,
            transform: on ? 'translateY(0)' : 'translateY(10px)',
            transition: 'opacity .5s .5s ease, transform .5s .5s ease',
          }}>
            <span style={{ fontSize: 16 }}>{modeEmoji[card.mode] || '🚗'}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#d4a853' }}>
              {cfg.label}
            </span>
          </div>
        </div>
      ) : (
        /* FULL STATE: normal card with journey details */
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '0 26px calc(88px + env(safe-area-inset-bottom, 0px))' }}>

        {/* FROM → TO with duration inline */}
        <div style={{
          display: 'flex', alignItems: 'flex-end', gap: 8, marginBottom: 18,
          opacity: on ? 1 : 0,
          transform: on ? 'translateY(0)' : 'translateY(10px)',
          transition: 'opacity .55s .15s ease, transform .55s .15s ease',
        }}>
          {/* FROM */}
          <div style={{ flex: 1 }}>
            <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.38)', marginBottom: 2 }}>From</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{card.from}</p>
          </div>

          {/* Connector */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', paddingBottom: 4 }}>
            <svg width="100%" height="32" viewBox="0 0 100 32" preserveAspectRatio="none">
              <line x1="0" y1="16" x2="100" y2="16" stroke="rgba(255,255,255,.12)" strokeWidth="1.5" strokeDasharray="4 4" />
              <line x1="0" y1="16" x2="100" y2="16"
                stroke={cfg.color} strokeWidth="1.5"
                strokeDasharray={PATH_LEN}
                strokeDashoffset={on ? 0 : PATH_LEN}
                style={{ transition: `stroke-dashoffset 1.2s .35s cubic-bezier(.4,0,.2,1)` }}
              />
              <circle cx="50" cy="16" r="4"
                fill="var(--sky)"
                opacity={on ? 1 : 0}
                style={{ filter: 'drop-shadow(0 0 4px rgba(79,143,171,.7))', transition: 'opacity .35s .9s ease' }}
              />
            </svg>
            <span className="ms fill" style={{
              position: 'absolute', fontSize: 11, color: cfg.color, marginTop: -4,
              ...fade('.9s'),
            }}>{cfg.icon}</span>
            {/* Duration below line */}
            {durationLabel && (
              <span style={{ fontSize: 9, fontWeight: 600, color: 'rgba(255,255,255,.38)', letterSpacing: '.04em', marginTop: 2 }}>
                {card.isEstimated ? '~' : ''}{durationLabel}
              </span>
            )}
          </div>

          {/* TO */}
          <div style={{ flex: 1, textAlign: 'right' }}>
            <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.09em', textTransform: 'uppercase', color: 'rgba(255,255,255,.38)', marginBottom: 2 }}>To</p>
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 28, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>{card.to}</p>
          </div>
        </div>

        {/* Departure → Arrival (actual times only) */}
        {!card.isEstimated && card.departureTime && card.arrivalTime && (
          <div style={{
            display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14,
            ...fade('.65s'),
          }}>
            <div>
              <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 1 }}>Departs</p>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: '#fff' }}>{card.departureTime}</p>
            </div>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,.14)', position: 'relative' }}>
              <div style={{ position: 'absolute', right: -4, top: -3, width: 6, height: 6, borderTop: '1px solid rgba(255,255,255,.2)', borderRight: '1px solid rgba(255,255,255,.2)', transform: 'rotate(45deg)' }} />
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'rgba(255,255,255,.35)', marginBottom: 1 }}>Arrives</p>
              <p style={{ fontFamily: 'var(--font-heading)', fontSize: 20, fontWeight: 600, color: '#fff' }}>{card.arrivalTime}</p>
            </div>
          </div>
        )}

        {/* Mode badge — service name + meta */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          padding: '9px 18px', borderRadius: 13,
          background: 'rgba(79,143,171,.1)', border: '1px solid rgba(79,143,171,.24)',
          backdropFilter: 'blur(8px)', marginBottom: 20,
          ...fade('.7s'),
        }}>
          <span className="ms fill" style={{ fontSize: 15, color: cfg.color }}>{cfg.icon}</span>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,.80)' }}>{cfg.label}</span>
          {metaLabel && (
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,.40)', marginLeft: 2 }}>{metaLabel}</span>
          )}
        </div>

        {/* Booking ref pill */}
        <div style={{ marginBottom: 16, ...fade('.8s') }}>
          {card.ref ? (
            <span style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '5px 12px', borderRadius: 8,
              background: 'rgba(0,0,0,.40)', backdropFilter: 'blur(8px)',
              border: '1px solid rgba(255,255,255,.14)',
              fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.75)',
            }}>
              <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.40)' }}>confirmation_number</span>
              {card.ref}
            </span>
          ) : (
            <button
              onClick={() => setSheetOpen(true)}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '5px 12px', borderRadius: 8, border: 'none',
                background: 'rgba(0,0,0,.35)', backdropFilter: 'blur(8px)',
                cursor: 'pointer',
                fontSize: 12, fontWeight: 500, color: 'rgba(255,255,255,.40)',
              }}
            >
              <span className="ms" style={{ fontSize: 13, color: 'rgba(255,255,255,.28)' }}>add</span>
              No booking ref · tap to add
            </button>
          )}
        </div>

        {/* Add details CTA (estimated — shown separately if no sheet trigger yet) */}
        {card.isEstimated && !card.departureTime && (
          <button
            onClick={() => setSheetOpen(true)}
            style={{
              display: 'flex', alignItems: 'center', gap: 6,
              padding: '8px 16px', borderRadius: 999, border: '1px solid rgba(255,255,255,.14)',
              background: 'rgba(0,0,0,.40)', backdropFilter: 'blur(8px)',
              cursor: 'pointer', marginBottom: 12,
              ...fade('1.0s'),
            }}
          >
            <span className="ms" style={{ fontSize: 15, color: 'var(--color-primary)' }}>add</span>
            <span style={{ fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,.65)' }}>Add {card.from} → {card.to} details</span>
          </button>
        )}

        {/* Swipe hint */}
        <p style={{ fontSize: 11, color: 'rgba(255,255,255,.28)', fontStyle: 'italic', ...fade('1.2s') }}>
          Swipe to start {card.to}
        </p>
      </div>
      )}
      {/* End placeholder/full conditional */}

      {/* Transit details sheet */}
      {sheetOpen && (
        <div
          onClick={() => setSheetOpen(false)}
          style={{
            position: 'absolute', inset: 0, zIndex: 50,
            background: 'rgba(0,0,0,.55)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'flex-end',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              width: '100%', borderRadius: '20px 20px 0 0',
              background: 'var(--color-surface)',
              border: '1px solid var(--color-border)',
              borderBottom: 'none',
              padding: '20px 20px 40px',
            }}
          >
            <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--color-border-m)', margin: '0 auto 20px' }} />
            <p style={{ fontFamily: 'var(--font-heading)', fontSize: 22, fontWeight: 600, color: 'var(--color-text-1)', marginBottom: 4 }}>
              {card.from} → {card.to}
            </p>
            <p style={{ fontSize: 12, color: 'var(--color-text-3)', marginBottom: 20 }}>
              Add your actual {card.mode === 'flight' ? 'flight' : card.mode === 'train' ? 'train' : 'travel'} details
            </p>

            <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>
                  Departure
                </label>
                <input type="time" value={dep} onChange={e => setDep(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border-m)', color: 'var(--color-text-1)', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none' }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>
                  Arrival
                </label>
                <input type="time" value={arr} onChange={e => setArr(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border-m)', color: 'var(--color-text-1)', fontSize: 15, fontFamily: 'var(--font-sans)', outline: 'none' }}
                />
              </div>
            </div>

            <div style={{ marginBottom: 18 }}>
              <label style={{ display: 'block', fontSize: 10, fontWeight: 700, letterSpacing: '.08em', textTransform: 'uppercase', color: 'var(--color-text-3)', marginBottom: 6 }}>
                {card.mode === 'flight' ? 'Flight number' : card.mode === 'train' ? 'Train / service' : 'Reference'} (optional)
              </label>
              <input type="text" value={ref} onChange={e => setRef(e.target.value)}
                placeholder={card.mode === 'flight' ? 'e.g. BA2551' : card.mode === 'train' ? 'e.g. Eurostar' : 'e.g. FlixBus 400'}
                style={{ width: '100%', padding: '10px 12px', borderRadius: 10, background: 'var(--color-bg)', border: '1px solid var(--color-border-m)', color: 'var(--color-text-1)', fontSize: 14, fontFamily: 'var(--font-sans)', outline: 'none' }}
              />
            </div>

            <button
              onClick={handleSaveDetails}
              disabled={!dep || !arr}
              style={{
                width: '100%', padding: '13px', borderRadius: 12, border: 'none',
                background: dep && arr ? 'var(--color-primary)' : 'var(--color-surface2)',
                color: dep && arr ? '#0f0d0c' : 'var(--color-text-4)',
                fontFamily: 'var(--font-sans)', fontSize: 14, fontWeight: 700,
                cursor: dep && arr ? 'pointer' : 'default',
                transition: 'background .2s ease, color .2s ease',
              }}
            >
              Save details
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
