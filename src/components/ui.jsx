'use client';
import React, { useEffect, useRef } from 'react';

export function Icon({ name, size = 20, ...props }) {
  const paths = {
    arrow: <><path d="M4 12h15M13 5l7 7-7 7" /></>,
    bag: <><path d="M5 7h14l1 14H4L5 7Z" /><path d="M9 8V6a3 3 0 0 1 6 0v2" /></>,
    menu: <><path d="M4 8h16M4 16h16" /></>,
    close: <path d="m6 6 12 12M6 18 18 6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    pin: <><path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0Z" /><circle cx="12" cy="10" r="2" /></>,
    heart: <path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" />,
    instagram: <><rect x="3" y="3" width="18" height="18" rx="5" /><circle cx="12" cy="12" r="4" /><path d="M17 6.8h.01" /></>,
    youtube: <><rect x="2" y="5" width="20" height="14" rx="4" /><path d="m10 9 5 3-5 3Z" /></>,
    facebook: <path d="M14 22V12h4l1-4h-5V6c0-2 1-3 4-3V0h-3c-4 0-6 2-6 6v2H6v4h3v10" />,
    music: <><path d="M14 3v12a4 4 0 1 1-4-4M14 3c0 4 3 5 6 5" /></>,
    x: <path d="M4 4l16 16M20 4 4 20" />,
    plus: <path d="M12 5v14M5 12h14" />,
    minus: <path d="M5 12h14" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    truck: <><path d="M3 7h11v9H3zM14 10h4l3 3v3h-7z" /><circle cx="7" cy="18" r="1.6" /><circle cx="17" cy="18" r="1.6" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    upload: <><path d="M12 16V4m0 0 4 4m-4-4-4 4" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></>,
    check: <path d="m5 12 4 4L19 6" />,
  };
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" {...props}>{paths[name] || paths.arrow}</svg>;
}
export function Paw({ className = '' }) {
  return <svg className={className} viewBox="0 0 64 64" fill="currentColor" aria-hidden="true"><ellipse cx="13" cy="25" rx="7" ry="9" transform="rotate(-28 13 25)" /><ellipse cx="27" cy="15" rx="7" ry="9" /><ellipse cx="43" cy="18" rx="7" ry="9" transform="rotate(15 43 18)" /><ellipse cx="54" cy="31" rx="6" ry="8" transform="rotate(30 54 31)" /><path d="M16 46c0-8 10-20 17-20s17 12 17 20c0 12-12 6-17 6s-17 6-17-6" /></svg>;
}
export function Flower({ className = '' }) {
  return <svg className={className} viewBox="0 0 100 100" aria-hidden="true"><g fill="currentColor">{[0, 60, 120, 180, 240, 300].map(a => <ellipse key={a} cx="50" cy="24" rx="17" ry="23" transform={`rotate(${a} 50 50)`} />)}</g><circle cx="50" cy="50" r="15" fill="#f3cf7b" /></svg>;
}
export function Modal({ title, children, onClose, wide = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const previous = document.activeElement;
    const oldOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current.showModal();
    return () => { document.body.style.overflow = oldOverflow; previous?.focus(); };
  }, []);
  return <dialog ref={ref} className={`modal ${wide ? 'modal-wide' : ''}`} onCancel={onClose} onClick={e => { if (e.target === ref.current) { const r = ref.current.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }} aria-labelledby="modal-title">
    <div className="modal-top"><span className="eyebrow">THE BIGCAT WORLD</span><button className="icon-button" aria-label="ปิดหน้าต่าง" onClick={onClose}><Icon name="close" /></button></div>
    <h2 id="modal-title">{title}</h2>{children}
  </dialog>;
}


export function PageLoader({ label = 'กำลังโหลด…' }) {
  return <div className="page-loader" role="status"><Paw /><span>{label}</span></div>;
}

// โลโก้จริง (หัวแมวเจาะคำ BIG CAT) — ไฟล์เป็นสีขาวโปร่งใส จึงใช้เป็น mask แล้วย้อมสีด้วย CSS
export function Logo({ className = '', wordmark = true, tone = 'ink' }) {
  return <span className={`brand ${className}`}><span className={`brand-mark ${tone}`} aria-hidden="true" />{wordmark && <span className="brand-word">BIGCAT</span>}</span>;
}
