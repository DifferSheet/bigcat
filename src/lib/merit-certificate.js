// All lettering is rendered from data, never baked into the artwork.
const WIDTH = 1080, HEIGHT = 1920;
const HEAD = 'BigcatCertificateChonburi';
const BODY = 'BigcatCertificateSerif';
let fontsReady;
let headReady = true;
const headFont = () => (headReady ? `400 ${'SIZE'}px ${HEAD}` : `700 ${'SIZE'}px ${BODY}`);

// โหลดฟอนต์ให้ canvas เห็นแน่ ๆ ทุกเบราว์เซอร์: (1) FontFace API (2) อุ่นฟอนต์ใน DOM ผ่าน @font-face ใน CSS (3) รอ document.fonts.load ของทั้งสอง family
async function loadFonts() {
  if (!fontsReady) fontsReady = (async () => {
    const faces = [
      new FontFace(HEAD, 'url(/fonts/certificate/Chonburi-Regular.ttf)', { weight: '400' }),
      new FontFace(BODY, 'url(/fonts/certificate/NotoSerifThai.ttf)', { weight: '100 900' }),
    ];
    for (const f of faces) { try { await f.load(); document.fonts.add(f); } catch { /* ใช้ @font-face จาก CSS แทน */ } }
    // อุ่นฟอนต์: ให้เบราว์เซอร์ render ตัวอักษรไทยด้วยฟอนต์นี้ใน DOM ก่อน (Safari/iOS canvas ต้องการ)
    let warm = document.querySelector('.cert-font-warm');
    if (!warm) { warm = document.createElement('div'); warm.className = 'cert-font-warm'; warm.setAttribute('aria-hidden', 'true'); warm.innerHTML = '<b>ใบอนุโมทนาบัตร จำนวน 1234567890 บาท</b><i>ขอมอบให้ ร่วมบุญ</i>'; document.body.appendChild(warm); }
    await Promise.all([document.fonts.load(`400 40px ${HEAD}`, 'ใบอนุโมทนา'), document.fonts.load(`400 40px ${BODY}`, 'ขอมอบให้')]);
    await document.fonts.ready;
    headReady = document.fonts.check(`400 40px ${HEAD}`);   // บางเครื่อง (Android WebView) โหลดไม่ติด → ใช้ฟอนต์ตัวเนื้อแบบหนาแทน
  })().catch(error => { fontsReady = null; throw error; });
  return fontsReady;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const timer = setTimeout(() => reject(new Error('โหลดภาพไม่สำเร็จ กรุณาลองใหม่')), 15000);
    image.onload = () => { clearTimeout(timer); resolve(image); };
    image.onerror = () => { clearTimeout(timer); reject(new Error('โหลดภาพไม่สำเร็จ กรุณาลองใหม่')); };
    image.src = src;
  });
}

function wrapText(ctx, text, width) {
  const lines = [];
  const segmenter = new Intl.Segmenter('th', { granularity: 'word' });
  const graphemes = new Intl.Segmenter('th', { granularity: 'grapheme' });
  for (const paragraph of String(text).split('\n')) {
    let line = '';
    for (const { segment } of segmenter.segment(paragraph)) {
      if (line.trim() && ctx.measureText(line + segment).width > width) { lines.push(line.trim()); line = ''; }
      if (ctx.measureText(segment).width > width) {
        for (const { segment: letter } of graphemes.segment(segment)) {
          if (line && ctx.measureText(line + letter).width > width) { lines.push(line.trim()); line = ''; }
          line += letter;
        }
      } else { line += segment; }
    }
    if (line.trim()) lines.push(line.trim());
  }
  return lines;
}

function textBlock(ctx, value, { y, height, size = 36, min = 18, width = 840, family = BODY, color = '#65431f', gold = false, maxLines = 2 }, report) {
  const text = String(value ?? '').trim();
  if (!text) return;
  let lines, lineHeight, actual = size;
  for (; actual >= min; actual--) {
    ctx.font = family === HEAD ? headFont().replace('SIZE', actual) : `400 ${actual}px ${family}`;
    lines = wrapText(ctx, text, width);
    lineHeight = actual * 1.55;
    if (lines.length <= maxLines && lines.length * lineHeight <= height && lines.every(line => ctx.measureText(line).width <= width)) break;
  }
  if (actual < min) throw new Error('ข้อความยาวเกินพื้นที่ใบอนุโมทนา กรุณาแจ้งแอดมินเพื่อจัดรูปแบบ');
  ctx.save();
  ctx.textAlign = 'left';   // จัดกึ่งกลางเองด้วย measureText — canvas บาง WebView ไม่เคารพ textAlign='center'
  ctx.textBaseline = 'alphabetic';
  const top = y + (height - lines.length * lineHeight) / 2;
  const metrics = [];
  const x = (line) => (WIDTH - ctx.measureText(line).width) / 2;
  lines.forEach((line, i) => {
    const baseline = top + lineHeight * (i + 0.78);
    if (gold) {
      const gradient = ctx.createLinearGradient(0, baseline - actual, 0, baseline + 4);
      gradient.addColorStop(0, '#815014'); gradient.addColorStop(0.3, '#d09a35');
      gradient.addColorStop(0.48, '#fff0bb'); gradient.addColorStop(0.62, '#c88a22'); gradient.addColorStop(1, '#794609');
      ctx.shadowColor = '#6e410944'; ctx.shadowBlur = 3; ctx.shadowOffsetY = 3;
      ctx.strokeStyle = '#865215'; ctx.lineWidth = 1.2; ctx.strokeText(line, x(line), baseline);
      ctx.shadowColor = 'transparent'; ctx.fillStyle = gradient;
    } else { ctx.fillStyle = color; }
    ctx.fillText(line, x(line), baseline);
    metrics.push(ctx.measureText(line).width);
  });
  ctx.restore();
  report?.({ text, lines, size: actual, y, height, widths: metrics, maxWidth: width });
}

function dateLabel(value) {
  if (!value) return '';
  const parsed = value instanceof Date ? value : new Date(String(value).replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return '';
  return new Intl.DateTimeFormat('th-TH', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Bangkok' }).format(parsed);
}

export function certificateTierForAmount(value) {
  const amount = Number(value);
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '' || !Number.isFinite(amount) || amount < 0) {
    throw new Error('ไม่พบยอดเงินที่ถูกต้อง กรุณาแจ้งแอดมิน');
  }
  return amount < 100 ? 1 : amount < 500 ? 2 : amount < 1000 ? 3 : 4;
}

export async function drawMeritCertificate(item, { onLayout } = {}) {
  const tier = certificateTierForAmount(item.amount);
  const amount = Number(item.amount);
  const [background, logo] = await Promise.all([
    loadImage(tier === 1 ? '/images/certificates/cream-gold-v1.webp' : `/images/certificates/cream-gold-tier-${tier}-${tier === 3 ? 'v2' : 'v3'}.webp`),
    loadImage('/images/bigcat-logo-ink.png'),
    loadFonts(),
  ]);
  const canvas = document.createElement('canvas');
  canvas.width = WIDTH; canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์นี้ไม่รองรับการสร้างภาพ');
  ctx.drawImage(background, 0, 0, WIDTH, HEIGHT);
  // Use the official transparent logo as-is, retaining its source aspect ratio.
  const logoHeight = 92, logoWidth = logoHeight * logo.naturalWidth / logo.naturalHeight;
  ctx.drawImage(logo, (WIDTH - logoWidth) / 2, 58, logoWidth, logoHeight);
  const draw = (text, options) => textBlock(ctx, text, options, onLayout);
  draw('ขอบคุณที่ร่วมสร้างความสุข', { y: 159, height: 46, size: 27, maxLines: 1 });
  draw('ใบอนุโมทนาบัตร', { y: 263, height: 136, size: 86, min: 60, family: HEAD, gold: true, maxLines: 1 });
  draw('ขอมอบให้', { y: 475, height: 60, size: 34, maxLines: 1 });
  draw(item.anonymous ? 'ผู้ไม่ประสงค์ออกนาม' : item.donor_name, { y: 538, height: 126, size: 78, min: 24, family: HEAD, color: '#603b13' });
  draw(item.dedication ? `ในนาม / อุทิศให้ ${item.dedication}` : '', { y: 667, height: 47, size: 25, min: 16, maxLines: 1 });
  draw(item.title, { y: 741, height: 84, size: 34, min: 20 });
  const detail = item.items?.length ? item.items.map(i => `${i.category}${i.units ? ` ${i.units} ${i.unit_name || ''}` : ''}`).join(' · ') : [item.units ? `${item.units} ${item.unit_name || ''}` : '', item.category].filter(Boolean).join(' · ');
  draw(detail, { y: 826, height: 51, size: 26, min: 16, maxLines: 1 });
  draw(`จำนวน ${amount.toLocaleString('th-TH', { maximumFractionDigits: 2 })} บาท`, { y: 875, height: 101, size: 63, min: 30, family: HEAD, gold: true, maxLines: 1 });
  draw(dateLabel(item.starts_at), { y: 969, height: 42, size: 27, maxLines: 1 });
  draw('ขอให้ความสุขที่คุณแบ่งปัน\nย้อนกลับมาเป็นความสุขก้อนใหญ่ ♡', { y: 1614, height: 133, size: 36, min: 26, width: 790 });
  draw('BIGCAT · ด้วยรักและอนุโมทนา', { y: 1760, height: 61, size: 28, maxLines: 1 });
  draw(item.code ? `เลขที่อ้างอิง ${item.code}` : '', { y: 1824, height: 39, size: 21, maxLines: 1, color: '#91714b' });
  return canvas.toDataURL('image/png');
}
