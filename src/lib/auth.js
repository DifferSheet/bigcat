'use client';
// สถานะสมาชิก (LINE / Google) ใช้ร่วมกันทั้งแอป — โหลด /api/me ครั้งเดียว แล้วแชร์ผ่าน useSyncExternalStore
import { useSyncExternalStore, useEffect } from 'react';
import { api } from './api.js';

let state = { user: null, providers: {}, loaded: false };
let promise = null;
const listeners = new Set();
const set = (next) => { state = { ...state, ...next }; listeners.forEach(fn => fn()); };
const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const get = () => state;
const getServer = () => state;   // SSR: ยังไม่รู้ว่าใครล็อกอิน → render แบบไม่ล็อกอินก่อน

export const loadUser = () => (promise ??= api('/me').then(r => set({ user: r.user, providers: r.providers || {}, loaded: true })).catch(() => set({ loaded: true })));
export const refreshUser = () => { promise = null; return loadUser(); };
export const logout = async () => { await api('/auth/logout', { method: 'POST' }).catch(() => {}); set({ user: null }); };
export const loginUrl = (provider, next) => `/api/auth/${provider}/start?next=${encodeURIComponent(next || (typeof location !== 'undefined' ? location.pathname : '/account'))}`;

export function useUser() {
  const s = useSyncExternalStore(subscribe, get, getServer);
  useEffect(() => { loadUser(); }, []);
  return s;   // { user, providers, loaded }
}

// เติมค่าจากโปรไฟล์ลงฟอร์มเฉพาะช่องที่ยังว่าง — เรียกใน useEffect ของหน้าฟอร์ม
// override=true → ค่าจากโปรไฟล์ทับค่าที่ฟอร์มมีอยู่ (ใช้เมื่อค่าเดิมเป็นแค่ความจำของ guest)
export const prefillFrom = (user, form, map, override = false) => {
  if (!user) return form;
  let changed = false; const next = { ...form };
  for (const [field, key] of Object.entries(map)) {
    if (user[key] && (override || !next[field]) && next[field] !== user[key]) { next[field] = user[key]; changed = true; }
  }
  return changed ? next : form;
};
