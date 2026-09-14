'use client';
import { useEffect, useState } from 'react';

// true หลัง hydrate เสร็จ — ใช้กั้นค่าที่อ่านจาก localStorage/sessionStorage
// เพื่อให้ render แรกฝั่ง client ตรงกับ HTML ที่ server ส่งมา (กัน hydration mismatch)
export function useMounted() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  return mounted;
}
