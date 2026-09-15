// วาด QR ลง canvas พร้อมโลโก้ BIGCAT ตรงกลาง — ใช้ error correction ระดับ H (ซ่อมได้ 30%) โลโก้จึงบังได้ ~20% ของพื้นที่โดยยังสแกนติด
import QRCode from 'qrcode';

const MARK = '/images/bigcat-mark-pink.webp';   // 256×190 (RGBA)
let markPromise = null;
const loadMark = () => (markPromise ??= new Promise((resolve) => { const im = new Image(); im.onload = () => resolve(im); im.onerror = () => resolve(null); im.src = MARK; }));

export async function drawQr(canvas, text, { size = 180, dark = '#33332f', logo = true } = {}) {
  await QRCode.toCanvas(canvas, text, { width: size, margin: 1, errorCorrectionLevel: logo ? 'H' : 'M', color: { dark, light: '#ffffff' } });
  if (!logo) return;
  const im = await loadMark();
  if (!im) return;
  const x = canvas.getContext('2d');
  const box = Math.round(canvas.width * 0.22);            // กล่องขาวกลาง QR (ต่อด้าน)
  const cx = canvas.width / 2, cy = canvas.height / 2, r = box * 0.22;
  x.save();
  x.fillStyle = '#ffffff';
  x.beginPath(); x.roundRect(cx - box / 2, cy - box / 2, box, box, r); x.fill();
  const w = box * 0.8, h = w * (im.height / im.width);
  x.drawImage(im, cx - w / 2, cy - h / 2, w, h);
  x.restore();
}
