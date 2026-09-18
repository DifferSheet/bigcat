'use client';
import React, { useEffect, useRef, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { useUser } from '../lib/auth.js';
import { api } from '../lib/api.js';
import { eventDate, parseDate } from '../lib/format.js';
import { EventStamp, SpecialStamp } from '../components/Stamp.jsx';
import { Modal, PageLoader } from '../components/ui.jsx';
import './passport-three.css';

function BookStage({ name, event, index, opened, engine, onBusy, onError, onTurn }) {
  const host = useRef(null), callbacks = useRef({ onBusy, onError, onTurn });
  callbacks.current = { onBusy, onError, onTurn };
  const [ready, setReady] = useState(false);
  const previous = useRef(null);
  useEffect(() => {
    let active = true, instance;
    import('../lib/passport-three.js').then(async ({ createPassportScene }) => {
      if (!active) return;
      instance = await createPassportScene(host.current, { name, onBusy: v => active && callbacks.current.onBusy(v), onError: e => active && callbacks.current.onError(e), onTurn: d => active && callbacks.current.onTurn(d) });
      if (!active) { instance.dispose(); return; }
      engine.current = instance; setReady(true);
    }).catch(() => { if (active) { callbacks.current.onError('อุปกรณ์หรือเบราว์เซอร์นี้เปิด 3D ไม่สำเร็จ คุณยังอ่าน Passport แบบปกติได้'); callbacks.current.onBusy(false); } });
    return () => { active = false; instance?.dispose(); engine.current = null; };
  }, [name, engine]);
  useEffect(() => {
    if (!ready) return;
    const before = previous.current; previous.current = index;
    engine.current.setEvent(event, index, before !== null && opened, before !== null && index < before ? -1 : 1).catch(() => { callbacks.current.onError('โหลดหน้านี้ไม่สำเร็จ กรุณาลองโหลดหน้าใหม่'); callbacks.current.onBusy(false); });
    // Opening/closing does not recreate page textures.
  }, [ready, event, index, engine]);
  return <div className="pt-stage" ref={host} data-testid="book-stage" />;
}

export default function PassportThreePage() {
  const { user, loaded } = useUser();
  const [data, setData] = useState(null), [error, setError] = useState('');
  const [opened, setOpened] = useState(false), [busy, setBusy] = useState(true), [index, setIndex] = useState(0), [filter, setFilter] = useState('all'), [detail, setDetail] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const engine = useRef(null), root = useRef(null);
  useEffect(() => { if (loaded && !user) location.replace('/login?next=/passport-3d'); }, [user, loaded]);
  useEffect(() => { if (!user) return; let active = true; api('/passport').then(d => { if (active) setData(d); }).catch(e => { if (active) setError(e.message); }); return () => { active = false; }; }, [user]);
  useEffect(() => {
    const change = () => setFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', change);
    return () => document.removeEventListener('fullscreenchange', change);
  }, []);
  useEffect(() => { if (!fullscreen) return; const old = document.body.style.overflow; document.body.style.overflow = 'hidden'; const escape = e => { if (e.key === 'Escape' && !document.querySelector('dialog[open]')) setFullscreen(false); }; document.addEventListener('keydown', escape); return () => { document.body.style.overflow = old; document.removeEventListener('keydown', escape); }; }, [fullscreen]);
  const all = (data?.books || []).flatMap(b => b.events);
  const events = all.filter(e => filter === 'all' || (filter === 'earned' ? !!e.earned : !e.earned && e.phase === 'upcoming'));
  const current = Math.min(index, Math.max(0, events.length - 1)), ev = events[current];
  const turn = delta => { if (!opened || busy || current + delta < 0 || current + delta >= events.length) return; setIndex(current + delta); };
  const toggle = async () => { if (!engine.current || busy) return; const next = !opened; await engine.current.setOpen(next); setOpened(next); };
  const full = async () => { if (fullscreen) { setFullscreen(false); if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); } else { setFullscreen(true); try { await root.current.requestFullscreen?.(); } catch { /* viewport fallback */ } } };
  if (!loaded || !user || (!data && !error)) return <PageLoader label="กำลังเตรียม Passport 3D…" />;
  return <main ref={root} className={`pt-page${fullscreen ? ' pt-fullscreen' : ''}`} onKeyDown={e => { if (/SELECT|INPUT|TEXTAREA/.test(e.target.tagName) || detail) return; if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); turn(e.key === 'ArrowRight' ? 1 : -1); } }}>
    <header className="pt-header"><Link to="/" aria-label="BIGCAT หน้าแรก"><img src="/images/bigcat-logo-ink.png" alt="BIGCAT" /></Link><span>THE COLLECTOR’S PASSPORT <small>3D PROTOTYPE</small></span><nav><Link to="/passport">แบบเดิม</Link><Link to="/passport-c">แบบ C</Link></nav></header>
    <div className="pt-title"><div><span>SMALL MOMENTS. BIG HAPPINESS.</span><h1>A little book,<em> a world of memories.</em></h1></div><p>สมุดของ <strong>{user.display_name}</strong> · {data?.total || 0} ดวง</p></div>
    {error && <div className="pt-error" role="alert">{error} <Link to="/passport-c">เปิดโหมดอ่านปกติ ↗</Link><button type="button" onClick={() => location.reload()}>ลองใหม่</button></div>}
    {data && <>
      <div className="pt-tools"><label>แสตมป์ <select aria-label="กรองแสตมป์" disabled={busy} value={filter} onChange={e => { setFilter(e.target.value); setIndex(0); }}><option value="all">ทั้งหมด</option><option value="earned">สะสมแล้ว</option><option value="locked">รอเก็บ</option></select></label><label>งาน <select aria-label="เลือกงาน" disabled={busy || !events.length} value={current} onChange={e => setIndex(Number(e.target.value))}>{events.length ? events.map((e, i) => <option key={e.slug} value={i}>{e.title}</option>) : <option value={0}>ยังไม่มีงานในหมวดนี้</option>}</select></label><button type="button" onClick={full}>{fullscreen ? 'ออกจากเต็มจอ' : 'เต็มจอ ⛶'}</button></div>
      <section className="pt-viewer" aria-label="ทดลองสมุดสามมิติ" aria-busy={busy}>
        <BookStage name={user.display_name} event={ev} index={current} opened={opened} engine={engine} onBusy={setBusy} onError={setError} onTurn={turn} />
        <span className="pt-hint" aria-live="polite">{busy ? 'กำลังเตรียมหน้าสมุด…' : opened ? 'ปัดซ้าย–ขวาเพื่อพลิกหน้า · มุมอ่านถูกล็อกไว้' : 'ลากหรือปัดเพื่อหมุนดูปก สัน และด้านหลัง'}</span>
      </section>
      <footer className="pt-controls"><button type="button" aria-label="หน้าก่อนหน้า" onClick={() => turn(-1)} disabled={busy || !opened || current === 0}>←</button><button type="button" className="pt-open" onClick={toggle} disabled={busy || !!error}>{opened ? 'ปิดสมุด · หมุนดูปก' : 'เปิดสมุดของฉัน'}</button><button type="button" aria-label="หน้าถัดไป" onClick={() => turn(1)} disabled={busy || !opened || current >= events.length - 1}>→</button><button type="button" onClick={() => engine.current?.reset()} disabled={busy}>คืนมุมเริ่มต้น</button><button type="button" onClick={() => setDetail(true)} disabled={!ev || busy}>อ่านรายละเอียด</button><span aria-live="polite">{events.length ? `${current + 1} / ${events.length} งาน` : 'รอความทรงจำแรก'}</span></footer>
    </>}
    <p className="pt-note">ต้นแบบ 3D · หยุดวาดเมื่อภาพนิ่ง · ข้อความเต็ม รูป และเสียงเปิดได้ที่ “อ่านรายละเอียด”</p>
    {detail && ev && <Modal title={ev.title} onClose={() => setDetail(false)}><div className="pt-detail"><EventStamp ev={ev} state={ev.earned ? 'earned' : ev.phase === 'upcoming' ? 'locked' : 'missed'} size={240} /><p>{eventDate(ev).long}</p><p>{ev.earned ? `ได้รับเมื่อ ${parseDate(ev.earned.earned_at).toLocaleDateString('th-TH')}` : 'ยังไม่ได้สะสมแสตมป์งานนี้'}</p>{ev.earned && <>{ev.unlock?.type === 'text' && <p className="pt-text">{ev.unlock.text}</p>}{ev.unlock?.type === 'image' && ev.unlock.src && <img className="pt-photo" src={ev.unlock.src} alt={ev.unlock.caption || 'ภาพจากงาน'} />}{ev.unlock?.type === 'audio' && ev.unlock.src && <audio controls preload="none" src={ev.unlock.src} />}{ev.unlock?.caption && <p>{ev.unlock.caption}</p>}<div className="pt-extras">{(ev.extras || []).map((s, i) => <SpecialStamp key={i} kind={s.kind} meta={s.meta} size={90} />)}</div></>}<Link to={`/events/${ev.slug}`}>ไปหน้างาน ↗</Link></div></Modal>}
  </main>;
}
