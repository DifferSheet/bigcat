'use client';
import React, { useEffect, useRef, useState } from 'react';

// ตัวแก้ไขข้อความแบบมีรูปแบบ (ตัวหนา/เอียง/ขีดเส้นใต้/หัวข้อ/bullet/ลิงก์)
// เก็บค่าเป็น HTML — server จะ sanitize อีกชั้นก่อนบันทึกเสมอ
const TOOLS = [
  ['bold', 'B', 'ตัวหนา', { fontWeight: 700 }],
  ['italic', 'I', 'ตัวเอียง', { fontStyle: 'italic' }],
  ['underline', 'U', 'ขีดเส้นใต้', { textDecoration: 'underline' }],
  ['formatBlock:h4', 'H', 'หัวข้อย่อย', { fontWeight: 700 }],
  ['insertUnorderedList', '•', 'รายการ', null],
  ['insertOrderedList', '1.', 'รายการมีเลข', null],
  ['createLink', '🔗', 'ใส่ลิงก์', null],
  ['removeFormat', '⌫', 'ล้างรูปแบบ', null],
];

export default function RichText({ value = '', onChange, placeholder = 'พิมพ์รายละเอียด…', rows = 10 }) {
  const ref = useRef(null);
  const [focused, setFocused] = useState(false);

  // อัปเดต DOM เฉพาะตอนค่าจากภายนอกต่างจากที่พิมพ์อยู่ (ไม่งั้น cursor จะเด้ง)
  useEffect(() => {
    if (ref.current && ref.current.innerHTML !== (value || '')) ref.current.innerHTML = value || '';
  }, [value]);

  const emit = () => onChange?.(ref.current?.innerHTML || '');

  const run = (cmd) => {
    ref.current?.focus();
    if (cmd === 'createLink') {
      const url = prompt('ใส่ลิงก์ (เช่น https://...)');
      if (!url) return;
      document.execCommand('createLink', false, url);
    } else if (cmd.startsWith('formatBlock:')) {
      const tag = cmd.split(':')[1];
      const inside = document.queryCommandValue('formatBlock')?.toLowerCase() === tag;
      document.execCommand('formatBlock', false, inside ? 'p' : tag);
    } else {
      document.execCommand(cmd, false, null);
    }
    emit();
  };

  // วางข้อความ: ใช้ text ล้วนเสมอ กัน style แปลก ๆ จากเว็บอื่นติดมา
  const onPaste = (e) => {
    e.preventDefault();
    const text = e.clipboardData.getData('text/plain');
    const html = text.split(/\n{2,}/).map(block => {
      const lines = block.split('\n').map(l => l.trim()).filter(Boolean);
      if (lines.every(l => /^[-•*]\s+/.test(l)) && lines.length) return `<ul>${lines.map(l => `<li>${l.replace(/^[-•*]\s+/, '')}</li>`).join('')}</ul>`;
      return `<p>${lines.join('<br>')}</p>`;
    }).join('');
    document.execCommand('insertHTML', false, html);
    emit();
  };

  const empty = !value || value === '<br>' || value === '<p></p>';
  return (
    <div className={`rt ${focused ? 'focus' : ''}`}>
      <div className="rt-bar" role="toolbar" aria-label="รูปแบบข้อความ">
        {TOOLS.map(([cmd, label, title, style]) => (
          <button key={cmd} type="button" title={title} aria-label={title} style={style || undefined}
            onMouseDown={(e) => e.preventDefault()} onClick={() => run(cmd)}>{label}</button>
        ))}
      </div>
      <div
        ref={ref}
        className="rt-area"
        contentEditable
        suppressContentEditableWarning
        style={{ minHeight: rows * 24 }}
        data-placeholder={empty ? placeholder : ''}
        onInput={emit}
        onBlur={() => { setFocused(false); emit(); }}
        onFocus={() => setFocused(true)}
        onPaste={onPaste}
      />
    </div>
  );
}
