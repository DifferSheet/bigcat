// Stable layouts: opening a memory again never shuffles its photographs.
export function eventMemory(ev) {
  const m = ev.memory || {};
  const earned = !!ev.earned;
  const ready = earned && ev.phase === 'past';
  const legacy = ready ? ev.unlock : null;
  const portrait = ready ? m.portraitImage || null : null;
  const group = ready ? (Object.hasOwn(m, 'groupImage') ? m.groupImage : legacy?.type === 'image' ? legacy.src : null) : null;
  const layout = ['warm', 'playful', 'special', 'merit'].includes(m.layout) ? m.layout : ev.type === 'merit' ? 'merit' : portrait ? 'playful' : 'warm';
  const t = m.texts || {};   // ข้อความที่สมาชิกตั้งเองในสมุดของตัวเอง
  return { layout, author: m.author === 'nobi' ? 'โนบิ' : 'บูตะ', group, portrait,
    noteImage: ready ? m.noteImage : null,
    noteText: ready ? (Object.hasOwn(m, 'noteText') ? m.noteText : legacy?.type === 'text' ? legacy.text : '') : '',
    heading: t.heading || 'เราอยู่ในความทรงจำเดียวกัน',
    groupCaption: t.groupCaption || 'วันของพวกเรา ♡',
    portraitCaption: t.portraitCaption || 'เธอกับเรา',
    caption: t.caption || m.caption || legacy?.caption || 'อีกหนึ่งวันดี ๆ ที่เราได้เจอกัน',
    texts: t, ready };
}
