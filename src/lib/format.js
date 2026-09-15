const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// MySQL 'YYYY-MM-DD HH:MM:SS' → Date (ถือเป็นเวลาท้องถิ่น)
export const parseDate = (s) => (s instanceof Date ? s : new Date(String(s).replace(' ', 'T')));
const pad = (n) => String(n).padStart(2, '0');

export function eventDate(ev) {
  const start = parseDate(ev.starts_at);
  const end = ev.ends_at ? parseDate(ev.ends_at) : null;
  const sameDay = end && start.toDateString() === end.toDateString();
  const time = `${pad(start.getHours())}:${pad(start.getMinutes())}${end ? ` – ${sameDay ? '' : `${end.getDate()} ${TH_MONTHS[end.getMonth()]} `}${pad(end.getHours())}:${pad(end.getMinutes())}`: ''} น.`;
  return {
    day: pad(start.getDate()), month: MONTHS[start.getMonth()], year: start.getFullYear() + 543,
    long: `${start.getDate()} ${TH_MONTHS[start.getMonth()]} ${start.getFullYear() + 543}`,
    time, start, end,
  };
}

export const statusLabel = {
  upcoming: ['เร็วๆ นี้', 'muted'], open: ['เปิดรับแล้ว', 'open'], soldout: ['เต็มแล้ว', 'full'],
  live: ['กำลังจัด', 'live'], ended: ['จบแล้ว', 'muted'], hidden: ['ซ่อนอยู่', 'muted'],
};

export const typeLabel = { fanmeet: 'Fan Meet', merit: 'ทำบุญ', busking: 'Busking', workshop: 'Workshop', popup: 'Pop-up store' };
export const baht = (n) => `฿${Number(n || 0).toLocaleString('th-TH')}`;
