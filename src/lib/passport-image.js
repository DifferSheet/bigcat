// รูป passport สำหรับแชร์ (IG Story 1080×1920) — วาดด้วย canvas ฝั่ง client
// แสตมป์ที่ได้ = วงกลมภาพ (ลายแอดมิน หรือภาพปก) ขอบสีงาน · งานที่พลาด = วงเทาจาง · แสตมป์พิเศษ = ตราสี
const W = 1080, H = 1920;
const loadImage = (src) => new Promise((resolve) => { if (!src) return resolve(null); const im = new Image(); im.crossOrigin = 'anonymous'; im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = src; });
const TONE = { pink: '#df8190', yellow: '#e2b53c', sage: '#7fa66f' };

function perforated(x, cx, cy, r, fill, stroke) {
  x.save();
  x.beginPath(); x.arc(cx, cy, r, 0, Math.PI * 2); x.fillStyle = fill; x.fill();
  // ขอบหยัก: เจาะวงกลมเล็กรอบขอบ
  x.globalCompositeOperation = 'destination-out';
  const n = 36; for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; x.beginPath(); x.arc(cx + Math.cos(a) * r, cy + Math.sin(a) * r, r * 0.065, 0, Math.PI * 2); x.fill(); }
  x.globalCompositeOperation = 'source-over';
  if (stroke) { x.beginPath(); x.arc(cx, cy, r * 0.74, 0, Math.PI * 2); x.strokeStyle = stroke; x.lineWidth = 3; x.stroke(); }
  x.restore();
}

export async function drawPassportImage(data) {
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const x = c.getContext('2d');
  const cs = getComputedStyle(document.documentElement);
  const F = { head: cs.getPropertyValue('--font-head').trim() || 'sans-serif', body: cs.getPropertyValue('--font-body').trim() || 'sans-serif', display: cs.getPropertyValue('--font-display').trim() || 'sans-serif' };
  await Promise.all([`700 120px ${F.display}`, `600 44px ${F.head}`, `500 34px ${F.body}`].map(f => document.fonts.load(f).catch(() => {})));

  const g = x.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#fff1ef'); g.addColorStop(1, '#fcf8f1');
  x.fillStyle = g; x.fillRect(0, 0, W, H);
  const mark = await loadImage('/images/bigcat-mark-pink.webp');
  if (mark) x.drawImage(mark, W / 2 - 70, 120, 140, 104);
  x.textAlign = 'center'; x.fillStyle = '#33332f';
  x.font = `700 120px ${F.display}`; x.fillText('PASSPORT', W / 2, 360);
  x.font = `600 44px ${F.head}`; x.fillStyle = '#7d7062'; x.fillText(data.user.display_name, W / 2, 430);
  x.font = `500 34px ${F.body}`; x.fillStyle = '#a3485a'; x.fillText(`สะสมแล้ว ${data.total} ดวง`, W / 2, 490);

  // ตารางแสตมป์: งานที่ผ่านมา/กำลังจัด (ได้ = ภาพ · พลาด = เงา) เรียงตามวัน + แสตมป์พิเศษต่อท้าย
  const slots = [];
  for (const b of data.books) for (const ev of b.events) if (ev.earned || ev.phase !== 'upcoming') slots.push({ ev, earned: !!ev.earned });
  const specials = [];
  for (const b of data.books) for (const ev of b.events) for (const s of ev.extras || []) specials.push({ kind: s.kind, meta: s.meta });
  if (data.friend) specials.push({ kind: 'friend', meta: data.friend.meta });
  // น้อยดวง → 2 คอลัมน์ดวงใหญ่ · หลายดวง → 3 คอลัมน์ · แถวสุดท้ายจัดกึ่งกลาง
  const cols = slots.length <= 4 ? 2 : 3, cell = cols === 2 ? 420 : 300, r = cols === 2 ? 160 : 118, top = 640;
  const imgs = await Promise.all(slots.map(s => loadImage(s.earned ? (s.ev.stamp?.image || s.ev.cover) : null)));
  slots.forEach((s, i) => {
    const row = Math.floor(i / cols), inRow = Math.min(cols, slots.length - row * cols);
    const cx = (W - inRow * cell) / 2 + cell / 2 + (i % cols) * cell, cy = top + row * (cell + 40);
    const tone = TONE[s.ev.tone] || TONE.pink;
    if (s.earned) {
      perforated(x, cx, cy, r, '#ffffff', s.ev.stamp?.image ? null : tone);
      const im = imgs[i];
      if (im) {
        x.save(); x.beginPath(); x.arc(cx, cy, s.ev.stamp?.image ? r * 0.88 : r * 0.72, 0, Math.PI * 2); x.clip();
        const side = Math.min(im.width, im.height), sx = (im.width - side) / 2, sy = (im.height - side) / 2, R = s.ev.stamp?.image ? r * 0.88 : r * 0.72;
        if (s.ev.stamp?.image) x.drawImage(im, cx - R, cy - R, R * 2, R * 2); else x.drawImage(im, sx, sy, side, side, cx - R, cy - R, R * 2, R * 2);
        x.restore();
      }
    } else {
      perforated(x, cx, cy, r, '#ebe4d9', null);
      x.font = `700 ${Math.round(r * 0.75)}px ${F.display}`; x.fillStyle = '#cfc5b7'; x.textAlign = 'center'; x.fillText('?', cx, cy + r * 0.27);
    }
    x.font = `500 ${cols === 2 ? 30 : 24}px ${F.body}`; x.fillStyle = s.earned ? '#33332f' : '#b3a897'; x.textAlign = 'center';
    const t = s.ev.title.length > (cols === 2 ? 24 : 18) ? s.ev.title.slice(0, cols === 2 ? 23 : 17) + '…' : s.ev.title;
    x.fillText(t, cx, cy + r + 44);
  });
  // แสตมป์พิเศษ (ตราเล็ก) แถวล่าง
  if (specials.length) {
    const y = top + Math.ceil(slots.length / cols) * (cell + 40) + 40;
    x.font = `600 30px ${F.head}`; x.fillStyle = '#7d7062'; x.textAlign = 'center'; x.fillText('แสตมป์พิเศษ', W / 2, y);
    const label = { lucky: 'LUCKY FAN', tier: 'ร่วมบุญ ✦', dayone: 'DAY ONE', first: 'มาครั้งแรก', friend: 'พามาเจอ' };
    const color = { lucky: '#c99a2e', tier: '#c99a2e', dayone: '#df8190', first: '#7fa66f', friend: '#5b8fd6' };
    const sw = 200, sl = (W - Math.min(specials.length, 5) * sw) / 2 + sw / 2;
    specials.slice(0, 5).forEach((s, i) => {
      const cx = sl + i * sw, cy = y + 110;
      x.beginPath(); for (let k = 0; k < 24; k++) { const a = (k / 24) * Math.PI * 2, rr = k % 2 ? 62 : 72; x[k ? 'lineTo' : 'moveTo'](cx + Math.cos(a) * rr, cy + Math.sin(a) * rr); } x.closePath();
      x.fillStyle = ['lucky', 'tier'].includes(s.kind) ? '#f2d27a' : '#fff'; x.fill(); x.strokeStyle = color[s.kind] || '#df8190'; x.lineWidth = 3; x.stroke();
      x.font = `700 22px ${F.head}`; x.fillStyle = color[s.kind] || '#df8190'; x.fillText(label[s.kind] || s.kind, cx, cy + 8);
      if (s.kind === 'friend' && s.meta?.count) { x.font = `700 20px ${F.head}`; x.fillText(`×${s.meta.count}`, cx, cy + 36); }
    });
  }
  x.font = `500 30px ${F.body}`; x.fillStyle = '#958779'; x.textAlign = 'center';
  x.fillText('bigcathouse.com/passport', W / 2, H - 120);
  x.font = `600 36px ${F.head}`; x.fillStyle = '#df8190'; x.fillText('Big cats. Lighter days.', W / 2, H - 170);
  return c;
}
