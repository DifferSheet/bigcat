// HTML ของคำอธิบายถูก sanitize ฝั่ง server แล้ว (server/richtext.js)
// ฝั่ง client แค่ต้องแปลงเป็น text เวลาใช้ใน meta/การ์ด
export const stripHtml = (html) => String(html ?? '')
  .replace(/<\/(p|li|h3|h4|ul|ol|blockquote)>/gi, ' ')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, '')
  .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
  .replace(/\s+/g, ' ').trim();
