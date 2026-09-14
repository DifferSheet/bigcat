// คำอธิบายสินค้าเก็บเป็น HTML — ต้อง sanitize ทุกครั้งก่อนบันทึก กัน XSS
import sanitizeHtml from 'sanitize-html';

const OPTIONS = {
  allowedTags: ['p', 'br', 'b', 'strong', 'i', 'em', 'u', 's', 'ul', 'ol', 'li', 'h3', 'h4', 'blockquote', 'a', 'span', 'hr'],
  allowedAttributes: { a: ['href', 'title', 'target', 'rel'] },
  allowedSchemes: ['http', 'https', 'mailto', 'tel'],
  transformTags: {
    // ลิงก์ออกนอกเว็บเปิดแท็บใหม่เสมอ และกัน tabnabbing
    a: (tagName, attribs) => ({ tagName: 'a', attribs: { ...attribs, target: '_blank', rel: 'noopener noreferrer' } }),
    div: 'p',
  },
  // ตัด style/class ที่ก็อปมาจากที่อื่นออกให้หมด เพื่อให้ใช้สไตล์ของเว็บเรา
  allowedStyles: {},
  nonTextTags: ['style', 'script', 'textarea', 'option', 'noscript'],
};

export const cleanHtml = (html) => sanitizeHtml(String(html ?? ''), OPTIONS).trim();

// แปลงข้อความธรรมดา (ที่มี "- " และบรรทัดว่าง) เป็น HTML — ใช้กับข้อมูลเก่าและตอน paste ข้อความดิบ
export function textToHtml(text) {
  const lines = String(text ?? '').replace(/\r\n/g, '\n').split('\n');
  const out = [];
  let list = null;
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const bullet = line.match(/^[-•*]\s+(.*)$/);
    const numbered = line.match(/^\d+[.)]\s+(.*)$/);
    if (bullet) {
      if (list !== 'ul') { closeList(); out.push('<ul>'); list = 'ul'; }
      out.push(`<li>${esc(bullet[1])}</li>`);
    } else if (numbered) {
      if (list !== 'ol') { closeList(); out.push('<ol>'); list = 'ol'; }
      out.push(`<li>${esc(numbered[1])}</li>`);
    } else {
      closeList();
      // บรรทัดสั้นที่ลงท้ายด้วย ":" หรือไม่มีจุด ถือเป็นหัวข้อย่อย
      const isHeading = line.length <= 60 && (/[:：]$/.test(line) || /^(จุดเด่น|คุณสมบัติ|รายละเอียด|เหมาะสำหรับ|วิธี|สิ่งที่|ภายใน|ขนาด|วัสดุ|การดูแล)/.test(line));
      out.push(isHeading ? `<h4>${esc(line.replace(/[:：]$/, ''))}</h4>` : `<p>${esc(line)}</p>`);
    }
  }
  closeList();
  return out.join('\n');
}

// ตัดแท็กออกเพื่อใช้ใน meta description / OG
export const htmlToText = (html) => sanitizeHtml(String(html ?? ''), { allowedTags: [], allowedAttributes: {} })
  .replace(/\s+/g, ' ').trim();

export const looksLikeHtml = (s) => /<(p|br|ul|ol|li|strong|b|em|i|h3|h4)\b/i.test(String(s ?? ''));
