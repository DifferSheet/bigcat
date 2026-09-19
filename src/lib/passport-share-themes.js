export const PASSPORT_SHARE_THEMES = [
  { id: 'linen', name: 'ลินิน', color: '#eee4d2', ink: '#79563d' },
  { id: 'rose', name: 'กุหลาบ', color: '#ecd0d6', ink: '#703e50' },
  { id: 'sky', name: 'ท้องฟ้า', color: '#d1e3ed', ink: '#34556c' },
  { id: 'lavender', name: 'ลาเวนเดอร์', color: '#e0d6ed', ink: '#59466b' },
  { id: 'sage', name: 'ใบชา', color: '#d8e0cf', ink: '#48583c' },
  { id: 'peach', name: 'พีช', color: '#f0d3bc', ink: '#7c4b31' },
  { id: 'sand', name: 'ทราย', color: '#d9c5a7', ink: '#65492f' },
  { id: 'navy', name: 'น้ำเงิน', color: '#23384f', ink: '#f9e9d1' },
  { id: 'cocoa', name: 'โกโก้', color: '#50382f', ink: '#fff0d7' },
  { id: 'wine', name: 'ไวน์', color: '#603745', ink: '#ffeddf' },
];
export const defaultPassportQuote = ev => ev.type === 'merit' || /ร่วมบุญ|พรรษา/.test(ev.title)
  ? 'ความสุขของการให้\nเก็บไว้ในความทรงจำ' : 'อีกหนึ่งวันดี ๆ\nที่เราได้เจอกัน';
