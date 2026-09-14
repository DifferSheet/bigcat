'use client';
// กติกา scroll ของทั้งเว็บ (แด๊ดติ 14 ก.ย. 2026: เปิดหน้าใหม่ไม่เริ่มที่ 0 · กด back แล้วเห็น animation)
//   1. เปิดหน้าใหม่ (คลิกลิงก์) → เริ่มที่บนสุด "ทันที" ไม่มี animation
//   2. back / forward → กลับไปตำแหน่งเดิมที่เคยอ่านค้างไว้ (เบราว์เซอร์คืนให้เอง เราไม่แตะ)
//   3. reload → อยู่ตำแหน่งเดิม
//   4. ลิงก์ #anchor ในหน้าเดียวกัน → เลื่อนนุ่ม ๆ เฉพาะกรณีนี้เท่านั้น
// เหตุที่ต้องมีไฟล์นี้: Next เลื่อนให้เฉพาะ "segment ที่เปลี่ยน" และจะไม่เลื่อนเลยถ้าหัวของ segment ยังอยู่ในจอ —
// ทุกหน้าของเรามี header แบบ sticky อยู่หัว segment จึงเข้าเงื่อนไข "ยังอยู่ในจอ" ตลอด ผลคือเปิดหน้าใหม่แล้วค้างตำแหน่งเดิม
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';

export default function ScrollManager() {
  const pathname = usePathname();
  const isPop = useRef(false);
  const first = useRef(true);

  useEffect(() => {
    const onPop = () => { isPop.current = true; };
    const onClick = (e) => {
      if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey) return;
      const a = e.target.closest?.('a[href^="#"]');
      if (!a) return;
      const id = decodeURIComponent(a.getAttribute('href').slice(1));
      const el = id && document.getElementById(id);
      if (!el) return;
      e.preventDefault();
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      history.pushState(null, '', `#${id}`);
    };
    window.addEventListener('popstate', onPop);
    document.addEventListener('click', onClick);
    return () => { window.removeEventListener('popstate', onPop); document.removeEventListener('click', onClick); };
  }, []);

  useEffect(() => {
    if (first.current) { first.current = false; return; }          // โหลดครั้งแรก/reload: ให้เบราว์เซอร์จัดการ
    if (isPop.current) { isPop.current = false; return; }          // back/forward: คืนตำแหน่งเดิม
    if (window.location.hash) return;                              // มี #anchor: Next เลื่อนไปหาเอง
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [pathname]);

  return null;
}
