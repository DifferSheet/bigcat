'use client';
import React, { useEffect, useState } from 'react';
import { useUser, prefillFrom } from '../lib/auth.js';
import { Link } from '../lib/nav.jsx';
import { Section, Notice, LoginToRegister } from '../components/EventShell.jsx';
import { PhoneInput } from '../components/forms.jsx';
import { OPENCHAT } from '../components/Social.jsx';
import { Icon } from '../components/ui.jsx';
import { api } from '../lib/api.js';

const myRegKey = (slug) => `bigcat-reg-${slug}`;

export default function BuskingRegister({ data }) {
  const { event: ev, registrations = { total: 0, checkedIn: 0 }, draws = [], songs = [] } = data;
  const rounds = ev.config.drawRounds || 3;
  // ปิดส่วนขอเพลงได้ต่องาน: config.songs = { enabled: false }
  const songsEnabled = ev.config.songs?.enabled !== false;
  const [form, setForm] = useState({ name: '', nickname: '', social: '', phone: '' });
  const { user } = useUser();
  useEffect(() => { setForm(f => prefillFrom(user, f, { name: 'display_name', phone: 'phone' })); }, [user]);
  const [mine, setMine] = useState(null);       // การลงทะเบียนของเบราว์เซอร์นี้
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [song, setSong] = useState({ title: '', artist: '' });
  const [voted, setVoted] = useState([]);
  useEffect(() => { try { setVoted(JSON.parse(localStorage.getItem(`bigcat-votes-${ev.slug}`) || '[]')); } catch { /* optional */ } }, [ev.slug]);

  // โหลดสถานะการลงทะเบียนของฉัน (ถ้ามี) — สถานะเช็คอิน/ผลสุ่ม
  useEffect(() => {
    let code = null; try { code = localStorage.getItem(myRegKey(ev.slug)); } catch { /* optional */ }
    if (!code && data.mine?.[0]?.code) code = data.mine[0].code;   // โหมด self: ผูกกับบัญชี
    if (code) api(`/registrations/${code}`).then(setMine).catch(() => {});
  }, [ev.slug, draws.length, registrations.checkedIn]);

  const register = async (e) => {
    e.preventDefault(); setBusy(true); setError('');
    try {
      const r = await api(`/events/${ev.slug}/registrations`, { method: 'POST', body: form });
      try { localStorage.setItem(myRegKey(ev.slug), r.code); } catch { /* optional */ }
      setMine(await api(`/registrations/${r.code}`));
    } catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const checkin = async () => {
    setBusy(true); setError('');
    try { await api(`/registrations/${mine.code}/checkin`, { method: 'POST' }); setMine(await api(`/registrations/${mine.code}`)); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  };
  const vote = async (id) => {
    if (voted.includes(id)) return;
    const next = [...voted, id]; setVoted(next); try { localStorage.setItem(`bigcat-votes-${ev.slug}`, JSON.stringify(next)); } catch { /* optional */ }
    await api(`/events/${ev.slug}/songs/${id}/vote`, { method: 'POST' }).catch(() => {});
  };
  const requestSong = async (e) => {
    e.preventDefault(); if (!song.title.trim()) return;
    await api(`/events/${ev.slug}/songs`, { method: 'POST', body: song }).catch(err => setError(err.message));
    setSong({ title: '', artist: '' });
  };

  const selfOnly = (ev.config?.registerMode || 'anyone') === 'self';
  const isLive = ev.status === 'live';
  const isWinner = mine?.luckyRound;

  return <>
    <Section eyebrow="REGISTER" title="ลงทะเบียนมาเจอ" aside={<span className="ev-summary">{registrations.total >= 10 ? <>ลงทะเบียนแล้ว <strong>{registrations.total}</strong> คน</> : 'เปิดลงทะเบียนแล้ว'}{isLive && registrations.checkedIn > 0 ? <> · เช็คอินแล้ว <strong>{registrations.checkedIn}</strong></> : null}</span>}>
      {mine ? <div className="my-reg">
        <div className="reg-number"><span className="eyebrow">หมายเลขของคุณ</span><strong>#{String(mine.number).padStart(3, '0')}</strong><span>{mine.nickname || mine.name}</span></div>
        {isWinner
          ? <Notice>🎉 คุณคือ Lucky Fan รอบที่ {isWinner}! มาข้างเวทีเพื่อถ่ายรูปคู่กับโนบิได้เลย</Notice>
          : mine.checked_in_at
            ? <Notice>เช็คอินแล้ว คุณอยู่ในกลุ่มลุ้น Lucky Fan ตอนท้ายงาน</Notice>
            : isLive
              ? <><p>มาถึงหน้างานแล้วใช่ไหม กดเช็คอินเพื่อรับสิทธิ์ลุ้น Lucky Fan</p><button className="button dark" onClick={checkin} disabled={busy}>ฉันมาถึงแล้ว <Icon name="check" /></button></>
              : <Notice tone="muted">ปุ่มเช็คอินจะเปิดเมื่อถึงเวลางาน กลับมาที่หน้านี้อีกครั้งเมื่อมาถึง</Notice>}
        <div className="form-actions"><Link className="button ghost" to={`/ticket/${mine.code}`}>เปิดบัตรลงทะเบียน</Link>{!selfOnly && <button type="button" className="link-button" onClick={() => { try { localStorage.removeItem(myRegKey(ev.slug)); } catch { /* optional */ } setMine(null); }}>ลงทะเบียนเป็นคนอื่น</button>}</div>
        {error && <Notice tone="error">{error}</Notice>}
      </div>
        : ev.status === 'ended' ? <Notice tone="muted">งานนี้จบแล้ว ขอบคุณทุกคนที่มาเจอกัน</Notice>
          : selfOnly && !user ? <LoginToRegister user={user} />
          : <form className="booking-form" onSubmit={register}>
            <p className="muted">ฟรี ไม่จำกัดจำนวน ลงทะเบียนแล้วเช็คอินหน้างานเพื่อลุ้น Lucky Fan ถ่ายรูปคู่กับโนบิ ({rounds} รางวัล)</p>
            <label>ชื่อ<input id="rg-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} /></label>
            <div className="two"><label>ชื่อเล่น (ที่จะประกาศตอนสุ่ม)<input id="rg-nick" value={form.nickname} onChange={e => setForm({ ...form, nickname: e.target.value })} /></label><label>IG / TikTok<input id="rg-social" value={form.social} onChange={e => setForm({ ...form, social: e.target.value })} placeholder="@" /></label></div>
            <label>เบอร์โทร (ถ้ามี)<PhoneInput id="rg-phone" value={form.phone} onChange={phone => setForm({ ...form, phone })} /></label>
            {error && <Notice tone="error">{error}</Notice>}
            <div className="form-actions"><button className="button dark" disabled={busy}>{busy ? 'กำลังลงทะเบียน…' : 'ลงทะเบียน'} <Icon name="arrow" /></button></div>
            <a className="openchat-link" href={OPENCHAT} target="_blank" rel="noopener">เข้าด้อมบิ๊กแคทใน OpenChat →</a>
          </form>}
    </Section>

    <Section eyebrow="LUCKY FAN" title="ผลสุ่มถ่ายรูปคู่" aside={<Link className="button ghost small" to={`/events/${ev.slug}/draw`}>เปิดจอสุ่ม ↗</Link>}>
      <div className="draw-rounds">{Array.from({ length: rounds }, (_, i) => {
        const d = draws.find(x => x.round === i + 1);
        return <div key={i} className={`draw-card ${d ? 'done' : ''}`}><span className="eyebrow">รอบที่ {i + 1}</span>{d ? <><strong>#{String(d.number).padStart(3, '0')}</strong><span>{d.nickname || d.name}</span>{d.social && <small>{d.social}</small>}</> : <span className="muted">รอสุ่มตอนท้ายงาน</span>}</div>;
      })}</div>
      <p className="small-note">สุ่มจากผู้ที่เช็คอินหน้างานเท่านั้น ผลจะขึ้นบนหน้านี้ทันทีที่สุ่ม</p>
    </Section>

    {songsEnabled && <Section eyebrow="SETLIST" title="เพลงวันนี้ + ขอเพลง">
      {ev.config.setlist?.length > 0 && <ol className="setlist">{ev.config.setlist.map(s => <li key={s}>{s}</li>)}</ol>}
      <ul className="songs">{songs.map(s => <li key={s.id}><button className={`vote ${voted.includes(s.id) ? 'voted' : ''}`} onClick={() => vote(s.id)} aria-label={`โหวต ${s.title}`}><Icon name="heart" size={15} />{s.votes}</button><span><strong>{s.title}</strong>{s.artist && <small> · {s.artist}</small>}</span></li>)}</ul>
      {ev.status !== 'ended' && <form className="song-form" onSubmit={requestSong}><input id="sg-title" value={song.title} onChange={e => setSong({ ...song, title: e.target.value })} placeholder="ชื่อเพลงที่อยากฟัง" required /><input id="sg-artist" value={song.artist} onChange={e => setSong({ ...song, artist: e.target.value })} placeholder="ศิลปิน" /><button className="button dark small">ขอเพลง</button></form>}
    </Section>}
  </>;
}
