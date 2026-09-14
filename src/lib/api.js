// ตัวช่วยเรียก API ของ server/ — JSON หรือ FormData (สำหรับอัปโหลดสลิป)
const ADMIN_KEY_STORAGE = 'bigcat-admin-key';

export const getAdminKey = () => { try { return sessionStorage.getItem(ADMIN_KEY_STORAGE) || ''; } catch { return ''; } };
export const setAdminKey = (key) => { try { key ? sessionStorage.setItem(ADMIN_KEY_STORAGE, key) : sessionStorage.removeItem(ADMIN_KEY_STORAGE); } catch { /* optional */ } };

export async function api(path, { method = 'GET', body, admin = false } = {}) {
  const headers = {};
  if (admin) headers['x-admin-key'] = getAdminKey();
  let payload = body;
  if (body && !(body instanceof FormData)) { headers['content-type'] = 'application/json'; payload = JSON.stringify(body); }
  const res = await fetch(`/api${path}`, { method, headers, body: payload });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw Object.assign(new Error(data.error || 'เกิดข้อผิดพลาด'), { status: res.status });
  return data;
}

// token สำหรับถือที่นั่งชั่วคราว — เก็บต่อเบราว์เซอร์
export const holdTokenFor = (slug) => {
  const key = `bigcat-hold-${slug}`;
  try {
    let t = sessionStorage.getItem(key);
    if (!t) { t = Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2); sessionStorage.setItem(key, t); }
    return t;
  } catch { return Math.random().toString(36).slice(2); }
};

// ค่าตั้งค่าสาธารณะจาก server (LINE OA, เปิดตรวจสลิปไหม) — โหลดครั้งเดียว
let configPromise = null;
export const siteConfig = () => (configPromise ??= api('/config').catch(() => ({})));

// token ประจำเบราว์เซอร์สำหรับโหวต
export const voterToken = () => {
  try {
    let t = localStorage.getItem('bigcat-voter');
    if (!t) { t = Math.random().toString(36).slice(2) + Date.now().toString(36); localStorage.setItem('bigcat-voter', t); }
    return t;
  } catch { return 'anon'; }
};
