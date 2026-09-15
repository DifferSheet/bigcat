'use client';
// สแกน QR ด้วยกล้องมือถือในหน้าเว็บ — ใช้ BarcodeDetector ของเบราว์เซอร์ถ้ามี (Android Chrome) ไม่งั้นถอดรหัสด้วย jsqr (iOS Safari)
import React, { useEffect, useRef, useState } from 'react';

export default function QrScanner({ onScan, onError }) {
  const video = useRef(null);
  const [status, setStatus] = useState('กำลังเปิดกล้อง…');
  useEffect(() => {
    let stream, stop = false, timer;
    const canvas = document.createElement('canvas');
    const run = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
        if (stop) { stream.getTracks().forEach(t => t.stop()); return; }
        video.current.srcObject = stream;
        await video.current.play();
        setStatus('เล็งกล้องไปที่ QR บนบัตร');
        const detector = 'BarcodeDetector' in window ? new window.BarcodeDetector({ formats: ['qr_code'] }) : null;
        const jsQR = detector ? null : (await import('jsqr')).default;
        const tick = async () => {
          if (stop) return;
          const v = video.current;
          if (v && v.readyState >= 2) {
            try {
              let text = '';
              if (detector) { const codes = await detector.detect(v); text = codes[0]?.rawValue || ''; }
              else {
                // ย่อภาพก่อนถอดรหัส — jsqr ทำงานบน CPU ภาพใหญ่จะช้า
                const scale = Math.min(1, 640 / v.videoWidth);
                canvas.width = Math.round(v.videoWidth * scale); canvas.height = Math.round(v.videoHeight * scale);
                const x = canvas.getContext('2d', { willReadFrequently: true });
                x.drawImage(v, 0, 0, canvas.width, canvas.height);
                const img = x.getImageData(0, 0, canvas.width, canvas.height);
                text = jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data || '';
              }
              if (text) { onScan(text); return; }   // พ่อแม่ปิด scanner เอง → cleanup หยุดกล้อง
            } catch { /* เฟรมนี้อ่านไม่ได้ ลองใหม่ */ }
          }
          timer = setTimeout(tick, 180);
        };
        tick();
      } catch (e) {
        setStatus('');
        onError?.(e.name === 'NotAllowedError' ? 'ไม่ได้รับอนุญาตให้ใช้กล้อง — เปิดสิทธิ์กล้องให้เว็บนี้ในตั้งค่าเบราว์เซอร์ หรือใช้แอปกล้องสแกน QR แทน' : `เปิดกล้องไม่ได้ (${e.message})`);
      }
    };
    run();
    return () => { stop = true; clearTimeout(timer); stream?.getTracks().forEach(t => t.stop()); };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return <div className="qr-scanner"><video ref={video} muted playsInline autoPlay /><div className="qr-frame" /><p>{status}</p></div>;
}
