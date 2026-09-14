'use client';
// ความยินยอมเรื่องคุกกี้ (PDPA) — เก็บใน localStorage `bigcat-consent`
// หมวด: necessary (ปิดไม่ได้: session ล็อกอิน · state OAuth · ตะกร้า) · functional (จำชื่อ/ที่อยู่ตอน checkout, จำว่าโหวต/ลงทะเบียนแล้ว)
// ยังไม่มีคุกกี้วิเคราะห์/โฆษณา — ถ้าเพิ่มในอนาคตให้เพิ่มหมวด `analytics` และ bump CONSENT_VERSION เพื่อถามใหม่
import { useSyncExternalStore } from 'react';

export const CONSENT_VERSION = 1;
const KEY = 'bigcat-consent';
const listeners = new Set();
let cache;

const read = () => {
  if (cache !== undefined) return cache;
  try { const c = JSON.parse(localStorage.getItem(KEY) || 'null'); cache = c && c.v === CONSENT_VERSION ? c : null; } catch { cache = null; }
  return cache;
};
export const getConsent = () => (typeof localStorage === 'undefined' ? null : read());
export const saveConsent = ({ functional }) => {
  cache = { v: CONSENT_VERSION, necessary: true, functional: !!functional, at: new Date().toISOString() };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* optional */ }
  if (!functional) for (const k of ['bigcat-checkout']) { try { localStorage.removeItem(k); } catch { /* optional */ } }
  listeners.forEach(fn => fn());
  return cache;
};
export const allowFunctional = () => !!getConsent()?.functional;

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const snap = () => getConsent();
const serverSnap = () => undefined;   // SSR: ยังไม่รู้ → ไม่ render แบนเนอร์ กัน hydration mismatch
export const useConsent = () => useSyncExternalStore(subscribe, snap, serverSnap);

// เปิดหน้าต่างตั้งค่าจากที่อื่น (ลิงก์ท้ายเว็บ)
export const openConsentSettings = () => window.dispatchEvent(new CustomEvent('bigcat:consent-open'));
