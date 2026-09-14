'use client';
import { useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

let socket = null;
// ต่อตรงไปที่ Express (Next rewrites ไม่ proxy WebSocket upgrade) — ตั้งค่าใน .env: NEXT_PUBLIC_API_ORIGIN
const API = process.env.NEXT_PUBLIC_API_ORIGIN || '';

// ใช้ socket เดียวทั้งแอป — เชื่อมต่อครั้งแรกเมื่อมีหน้าที่ต้องการ realtime
export function getSocket() {
  if (!socket) socket = API ? io(API, { transports: ['websocket', 'polling'] }) : io({ transports: ['websocket', 'polling'] });
  return socket;
}

/**
 * เข้าห้องของกิจกรรม แล้วรับ event ต่างๆ:
 *   snapshot (ข้อมูลเต็มตอน join), seats, donations, registrations, draw, songs, event
 * handlers เปลี่ยนได้โดยไม่ต้อง re-subscribe
 */
export function useEventSocket(slug, handlers, onStatus) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!slug) return;
    const s = getSocket();
    const names = ['snapshot', 'seats', 'donations', 'registrations', 'draw', 'songs', 'event', 'polls', 'report'];
    const bound = names.map(name => [name, payload => ref.current?.[name]?.(payload)]);
    bound.forEach(([n, fn]) => s.on(n, fn));
    const join = () => { s.emit('join', slug); onStatus?.(true); };
    const drop = () => onStatus?.(false);
    s.on('connect', join); s.on('disconnect', drop);
    if (s.connected) join();
    return () => { bound.forEach(([n, fn]) => s.off(n, fn)); s.off('connect', join); s.off('disconnect', drop); };
  }, [slug]);
}
