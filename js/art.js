'use strict';
/* =====================================================================
   Dealer Empire — character art: deterministic looks for people,
   SVG portraits with expressions, and colour helpers for the world.
   ===================================================================== */

function hashStr(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function hrand(seed, n) { const x = Math.sin(seed * 9301 + n * 49297) * 233280; return x - Math.floor(x); }
function hexRgb(h) { const n = parseInt(h.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
function rgbHex(r, g, b) { return '#' + [r, g, b].map(v => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')).join(''); }
function shade(hex, f) { const [r, g, b] = hexRgb(hex); return f >= 0 ? rgbHex(r + (255 - r) * f, g + (255 - g) * f, b + (255 - b) * f) : rgbHex(r * (1 + f), g * (1 + f), b * (1 + f)); }

const SKIN = ['#f6d7c3', '#eec3a0', '#d9a37e', '#bf8160', '#9a5f41', '#6e4230'];
const HAIR = ['#1f1a17', '#3b2a20', '#6b4a2f', '#a7773f', '#d6b16a', '#8d8d8d', '#b8432c'];
const SHIRTS = ['#2f6db5', '#c4473a', '#3e8e5e', '#7a5bb5', '#d08a2c', '#3f4a56', '#2a9ea0', '#b8546f', '#e2d9c8', '#5c6f2e'];

/* A stable look for any person id */
function lookOf(id, opt = {}) {
  const h = hashStr(String(id));
  const r = n => hrand(h % 100000, n);
  return {
    skin: SKIN[Math.floor(r(1) * SKIN.length)],
    hair: r(8) < 0.12 ? HAIR[5] : HAIR[Math.floor(r(2) * (HAIR.length - 1))],
    hairStyle: Math.floor(r(3) * 6),
    shirt: opt.uniform || SHIRTS[Math.floor(r(4) * SHIRTS.length)],
    pants: ['#2b3440', '#3d3a36', '#4a5566', '#1f2a36', '#6b5b45'][Math.floor(r(5) * 5)],
    glasses: r(6) < 0.22,
    beard: r(7) < 0.18,
    height: 0.92 + r(9) * 0.14,
  };
}

/* Portrait SVG. mood 0..100 drives the expression. */
function portrait(id, mood = 60, opt = {}) {
  const L = lookOf(id, opt);
  const m = clamp(mood, 0, 100);
  const smile = (m - 50) / 50; // -1 .. 1
  const mouthY = 86, mw = 12;
  const mouth = `M${60 - mw} ${mouthY - smile * 2} Q60 ${mouthY + smile * 9} ${60 + mw} ${mouthY - smile * 2}`;
  const browTilt = m < 35 ? 4 : m > 75 ? -1.5 : 0;
  const hairBack = [
    `<path d="M24 62 Q22 22 60 18 Q98 22 96 62 L96 92 Q88 70 86 50 Q60 44 34 50 Q32 70 24 92Z" fill="${L.hair}"/>`,
    `<path d="M26 58 Q26 20 60 18 Q94 20 94 58 Q86 40 60 38 Q34 40 26 58Z" fill="${L.hair}"/>`,
    `<path d="M22 70 Q18 18 60 16 Q102 18 98 70 L100 118 L84 118 Q90 80 86 52 Q60 42 34 52 Q30 80 36 118 L20 118Z" fill="${L.hair}"/>`,
    `<path d="M28 54 Q30 24 60 22 Q90 24 92 54 Q80 34 60 34 Q40 34 28 54Z" fill="${L.hair}"/>`,
    `<circle cx="60" cy="40" r="30" fill="${L.hair}"/><circle cx="38" cy="50" r="16" fill="${L.hair}"/><circle cx="82" cy="50" r="16" fill="${L.hair}"/>`,
    `<path d="M30 50 Q34 30 60 28 Q86 30 90 50 Q74 40 60 42 Q46 40 30 50Z" fill="${L.hair}"/>`,
  ][L.hairStyle];
  return `<svg class="portrait" viewBox="0 0 120 130" aria-hidden="true">
    <rect width="120" height="130" fill="${opt.bg || 'transparent'}"/>
    <path d="M14 130 Q16 100 60 98 Q104 100 106 130Z" fill="${L.shirt}"/>
    <path d="M48 98 L60 112 L72 98" fill="none" stroke="${shade(L.shirt, -0.25)}" stroke-width="3"/>
    <rect x="50" y="82" width="20" height="20" rx="6" fill="${shade(L.skin, -0.08)}"/>
    ${hairBack}
    <ellipse cx="60" cy="64" rx="27" ry="31" fill="${L.skin}"/>
    <ellipse cx="33" cy="66" rx="5" ry="7" fill="${shade(L.skin, -0.06)}"/><ellipse cx="87" cy="66" rx="5" ry="7" fill="${shade(L.skin, -0.06)}"/>
    ${L.hairStyle === 2 || L.hairStyle === 4 ? `<path d="M34 54 Q42 34 60 36 Q78 34 86 54 Q72 44 60 46 Q48 44 34 54Z" fill="${L.hair}"/>` : L.hairStyle !== 5 ? `<path d="M33 56 Q36 32 60 32 Q84 32 87 56 Q76 42 60 44 Q44 42 33 56Z" fill="${L.hair}"/>` : ''}
    <path d="M42 ${53 - browTilt} L54 ${53 + browTilt * 0.4}" stroke="${shade(L.hair, -0.2)}" stroke-width="3" stroke-linecap="round"/>
    <path d="M78 ${53 - browTilt} L66 ${53 + browTilt * 0.4}" stroke="${shade(L.hair, -0.2)}" stroke-width="3" stroke-linecap="round"/>
    <ellipse cx="48" cy="63" rx="3.2" ry="${m < 25 ? 2 : 3.6}" fill="#1d1d1f"/><ellipse cx="72" cy="63" rx="3.2" ry="${m < 25 ? 2 : 3.6}" fill="#1d1d1f"/>
    ${L.glasses ? `<g fill="none" stroke="#2a2a2e" stroke-width="2.2"><rect x="38" y="56" width="19" height="14" rx="5"/><rect x="63" y="56" width="19" height="14" rx="5"/><path d="M57 62 h6"/></g>` : ''}
    <path d="M60 66 Q57 75 61 77" fill="none" stroke="${shade(L.skin, -0.22)}" stroke-width="2" stroke-linecap="round"/>
    ${L.beard ? `<path d="M36 72 Q40 98 60 100 Q80 98 84 72 Q78 90 60 92 Q42 90 36 72Z" fill="${L.hair}" opacity=".9"/>` : ''}
    <path d="${mouth}" fill="none" stroke="#7a2e2a" stroke-width="3" stroke-linecap="round"/>
    ${m > 70 ? `<ellipse cx="42" cy="76" rx="5" ry="3" fill="#e46a6a" opacity=".25"/><ellipse cx="78" cy="76" rx="5" ry="3" fill="#e46a6a" opacity=".25"/>` : ''}
  </svg>`;
}
