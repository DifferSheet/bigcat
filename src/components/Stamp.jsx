'use client';
// แสตมป์ใน passport — ลายจากแอดมิน (ภาพ) หรือวาดจากภาพปกงาน (SVG: ขอบหยัก + ชื่องานโค้งบน + วันที่โค้งล่าง)
// state: earned (ได้แล้ว) · missed (งานผ่านไป ไม่ได้ไป → เงาจาง) · locked (งานยังไม่ถึง → ช่องว่าง)
import React from 'react';
import { eventDate } from '../lib/format.js';
import { eventStampArt, SPECIAL_STAMP_ART } from '../lib/stamp-art.js';

const TONE = { pink: '#df8190', yellow: '#e2b53c', sage: '#7fa66f' };
const KIND_LABEL = { checkin: 'มางาน', merit: 'ร่วมบุญ', lucky: 'LUCKY FAN', dayone: 'DAY ONE', first: 'มาครั้งแรก', friend: 'พามาเจอ' };

export function EventStamp({ ev, state = 'earned', size = 128 }) {
  const art = eventStampArt(ev);
  const uid = React.useId().replace(/:/g, '');
  const d = eventDate(ev);
  const tone = TONE[ev.tone] || TONE.pink;
  const r = 50, teeth = 36;
  // ขอบหยักแบบแสตมป์ไปรษณีย์ — วงกลมเล็ก ๆ เรียงรอบเส้นรอบวง
  const perf = Array.from({ length: teeth }, (_, i) => { const a = (i / teeth) * Math.PI * 2; return <circle key={i} cx={50 + Math.cos(a) * r} cy={50 + Math.sin(a) * r} r={3.2} />; });
  // ลายวาดของงาน (มีขอบหยักในตัว) → ใช้ภาพตรง ๆ ไม่ซ้อนกรอบ SVG
  if (art && state === 'earned') return <span className={`stamp stamp-art stamp-${state}`} style={{ width: size, height: size }} role="img" aria-label={`${KIND_LABEL[ev.earned?.kind] || 'แสตมป์'} ${ev.title}`}><img src={art} alt="" width={size} height={size} draggable={false} /></span>;
  const img = ev.cover;
  return <svg className={`stamp stamp-${state}`} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={`${KIND_LABEL[ev.earned?.kind] || 'แสตมป์'} ${ev.title}`}>
    <defs>
      <clipPath id={`c${uid}`}><circle cx="50" cy="50" r="36" /></clipPath>
      <mask id={`m${uid}`}><rect width="100" height="100" fill="#fff" /><g fill="#000">{perf}</g></mask>
      <path id={`t${uid}`} d="M 50 50 m -42 0 a 42 42 0 1 1 84 0" />
      <path id={`b${uid}`} d="M 50 50 m -42 0 a 42 42 0 1 0 84 0" />
    </defs>
    <g mask={`url(#m${uid})`}>
      <circle cx="50" cy="50" r="48" fill={state === 'earned' ? '#fff' : '#f3ede4'} stroke={tone} strokeWidth={state === 'earned' ? 1.5 : 0} />
    </g>
    {state === 'earned' && <>
      {img && <image href={img} x="14" y="14" width="72" height="72" preserveAspectRatio="xMidYMid slice" clipPath={`url(#c${uid})`} />}
      <circle cx="50" cy="50" r="36" fill="none" stroke={tone} strokeWidth="1.2" />
      <text fontSize="6.2" fontWeight="700" fill={tone} letterSpacing=".4"><textPath href={`#t${uid}`} startOffset="50%" textAnchor="middle">{ev.title.length > 26 ? ev.title.slice(0, 25) + '…' : ev.title}</textPath></text>
      <text fontSize="5.6" fontWeight="600" fill="#6b6259"><textPath href={`#b${uid}`} startOffset="50%" textAnchor="middle">{`${d.long}`}</textPath></text>
    </>}
    {state !== 'earned' && <text x="50" y="56" textAnchor="middle" fontSize="18" fill="#c8bfb2" fontWeight="700">{state === 'missed' ? '—' : '?'}</text>}
  </svg>;
}

// แสตมป์พิเศษ: ถ้ามีไฟล์ลายวาด public/images/stamps/<kind>.webp ใช้ภาพนั้น (มี badge ตัวเลข/รอบทับมุม) · ไม่มี → วาดเป็นตรา SVG
const ART = SPECIAL_STAMP_ART;
const artOk = typeof window !== 'undefined' ? (window.__stampArt ??= {}) : {};
export function SpecialStamp({ kind, meta, size = 128, label }) {
  const uid = React.useId().replace(/:/g, '');
  const [loadedSrc, setLoadedSrc] = React.useState(null);
  const src = ART[kind];
  const hasArt = !!src && (loadedSrc === src || artOk[src] === true);
  React.useEffect(() => {
    if (!src || artOk[src] != null) return;
    const im = new Image(); let active = true;
    im.onload = () => { artOk[src] = true; if (active) setLoadedSrc(src); };
    im.onerror = () => { artOk[src] = false; };
    im.src = src;
    return () => { active = false; };
  }, [src]);
  if (hasArt) return <span className={`stamp-art ${kind === 'lucky' ? 'foil' : ''}`} style={{ width: size, height: size }} role="img" aria-label={label || KIND_LABEL[kind]}>
    <img src={ART[kind]} alt="" width={size} height={size} draggable={false} />
    {kind === 'friend' && meta?.count > 0 && <b className="stamp-badge">×{meta.count}</b>}
    {kind === 'lucky' && meta?.round && <b className="stamp-badge">รอบ {meta.round}</b>}
  </span>;
  const foil = kind === 'lucky';
  const color = { lucky: '#c99a2e', dayone: '#df8190', first: '#7fa66f', friend: '#5b8fd6' }[kind] || '#df8190';
  const icon = { lucky: '★', dayone: '1', first: '♡', friend: '♡♡' }[kind] || '●';
  const text = label || KIND_LABEL[kind];
  return <svg className={`stamp stamp-earned stamp-special ${foil ? 'foil' : ''}`} viewBox="0 0 100 100" width={size} height={size} role="img" aria-label={text}>
    <defs>
      <linearGradient id={`g${uid}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#f6e3a1" /><stop offset=".5" stopColor="#c99a2e" /><stop offset="1" stopColor="#f2d27a" /></linearGradient>
      <path id={`p${uid}`} d="M 50 50 m -36 0 a 36 36 0 1 0 72 0" />
    </defs>
    <polygon points={Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2, rr = i % 2 ? 42 : 48; return `${50 + Math.cos(a) * rr},${50 + Math.sin(a) * rr}`; }).join(' ')} fill={foil ? `url(#g${uid})` : '#fff'} stroke={foil ? '#b8860b' : color} strokeWidth="1.5" />
    <circle cx="50" cy="50" r="30" fill={foil ? '#fff8e6' : '#fff'} stroke={foil ? '#b8860b' : color} strokeWidth="1" />
    <text x="50" y={kind === 'friend' && meta?.count > 1 ? 52 : 58} textAnchor="middle" fontSize={kind === 'friend' ? 16 : 24} fill={foil ? '#b8860b' : color} fontWeight="700">{icon}</text>
    {kind === 'friend' && meta?.count > 0 && <text x="50" y="70" textAnchor="middle" fontSize="9" fill={color} fontWeight="700">×{meta.count}</text>}
    {kind === 'lucky' && meta?.round && <text x="50" y="72" textAnchor="middle" fontSize="8" fill="#8a6a1c" fontWeight="700">รอบ {meta.round}</text>}
    <text fontSize="6.5" fontWeight="700" fill={foil ? '#8a6a1c' : color} letterSpacing=".5"><textPath href={`#p${uid}`} startOffset="50%" textAnchor="middle">{text}</textPath></text>
  </svg>;
}

export const STAMP_LABEL = KIND_LABEL;
