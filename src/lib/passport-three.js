// Lazy-loaded by the experimental route only. No perpetual render loop.
import * as THREE from 'three';
import { eventStampArt, SPECIAL_STAMP_ART } from './stamp-art.js';
import { eventDate } from './format.js';

export async function createPassportScene(host, { name, onError, onBusy, onTurn }) {
  let disposed = false, opened = false, busy = false, frame = 0, animation = null, requestId = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const textures = new Set(), cache = new Map();
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'low-power' });
  renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 1.5));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const canvas = renderer.domElement;
  canvas.setAttribute('aria-label', 'สมุด Passport สามมิติ ลากเพื่อหมุนเมื่อปิดเล่ม ปัดเพื่อเปลี่ยนหน้าเมื่อเปิด');
  canvas.setAttribute('role', 'img'); host.appendChild(canvas);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, .1, 60);
  scene.add(new THREE.HemisphereLight(0xfffaf0, 0x917784, 2.3));
  const light = new THREE.DirectionalLight(0xffe5c5, 2.5); light.position.set(-3, 5, 7); scene.add(light);
  const fill = new THREE.DirectionalLight(0xffffff, 1); fill.position.set(4, 1, 3); scene.add(fill);
  const book = new THREE.Group(); scene.add(book); book.rotation.set(-.12, -.38, -.045);
  const geometry = (w, h, d) => new THREE.BoxGeometry(w, h, d);
  const material = color => new THREE.MeshStandardMaterial({ color, roughness: .8, metalness: .06 });
  const cloth = material(0xd6a2a8), paper = material(0xf9efda), gold = new THREE.MeshStandardMaterial({ color: 0xcba96c, roughness: .45, metalness: .45 });
  const block = new THREE.Mesh(geometry(2.54, 3.5, .18), paper); book.add(block);
  const rear = new THREE.Mesh(geometry(2.66, 3.65, .07), cloth); rear.position.z = -.14; book.add(rear);
  for (let i = 0; i < 8; i++) { const edge = new THREE.Mesh(geometry(.012, 3.45, .003), gold); edge.position.set(1.277, 0, -.075 + i * .02); book.add(edge); }
  const spine = new THREE.Mesh(new THREE.CylinderGeometry(.12, .12, 3.62, 12), cloth); spine.position.set(-1.3, 0, -.02); book.add(spine);
  const cover = new THREE.Group(); cover.position.set(-1.32, 0, .15); book.add(cover);
  const coverBody = new THREE.Mesh(geometry(2.65, 3.65, .065), cloth); coverBody.position.x = 1.325; cover.add(coverBody);
  const face = (parent, x, z, back = false) => {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 3.53), mat); mesh.position.set(x, 0, z); if (back) mesh.rotation.y = Math.PI; parent.add(mesh); return mesh;
  };
  const front = face(cover, 1.325, .035);
  const left = face(cover, 1.325, -.035, true);
  const back = face(book, 0, -.178, true);
  const right = face(book, 0, .101);
  const leaf = new THREE.Group(); leaf.position.set(-1.32, 0, .19); book.add(leaf); leaf.visible = false;
  const leafFront = face(leaf, 1.32, .003), leafBack = face(leaf, 1.32, -.003, true);
  const draw = () => {
    frame = 0; if (disposed || document.hidden) return;
    renderer.render(scene, camera);
    host.dataset.frames = String(renderer.info.render.frame);
    host.dataset.textures = String(renderer.info.memory.textures);
  };
  const invalidate = () => { if (!frame && !disposed) frame = requestAnimationFrame(draw); };
  const fit = () => {
    const w = host.clientWidth, h = host.clientHeight; if (!w || !h || disposed) return;
    renderer.setSize(w, h, false); camera.aspect = w / h;
    const halfH = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    const distance = Math.max(2.12 / halfH, (opened ? 2.98 : 1.85) / (halfH * camera.aspect));
    camera.position.set(0, 0, distance); camera.lookAt(0, 0, 0); camera.updateProjectionMatrix(); invalidate();
  };
  const observer = new ResizeObserver(fit); observer.observe(host); fit();
  const image = src => {
    if (!src) return Promise.resolve(null);
    if (cache.has(src)) return cache.get(src);
    const pending = new Promise(resolve => { const im = new Image(); im.crossOrigin = 'anonymous'; const timeout = setTimeout(() => { im.onload = im.onerror = null; resolve(null); }, 8000); im.onload = () => { clearTimeout(timeout); resolve(im); }; im.onerror = () => { clearTimeout(timeout); resolve(null); }; im.src = src; });
    cache.set(src, pending); if (cache.size > 12) cache.delete(cache.keys().next().value); return pending;
  };
  const makeCanvas = () => { const c = document.createElement('canvas'); c.width = 768; c.height = 1060; const x = c.getContext('2d'); x.fillStyle = '#fff7e8'; x.fillRect(0, 0, 768, 1060); x.strokeStyle = '#c6a278'; x.lineWidth = 2; x.strokeRect(28, 28, 712, 1004); x.strokeRect(38, 38, 692, 984); return { c, x }; };
  const texture = c => { const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy()); textures.add(t); return t; };
  const text = (x, value, y, size = 28, color = '#725144') => { x.fillStyle = color; x.textAlign = 'center'; x.font = `${size}px sans-serif`; x.fillText(value, 384, y, 660); };
  const contain = (x, im, px, py, w, h) => { if (!im) return; const scale = Math.min(w / im.width, h / im.height); const iw = im.width * scale, ih = im.height * scale; x.drawImage(im, px + (w - iw) / 2, py + (h - ih) / 2, iw, ih); };
  const lines = (x, value, y, maxLines = 4, size = 36) => {
    x.font = `${size}px sans-serif`; let row = '', count = 0;
    for (const char of String(value || '')) { if (x.measureText(row + char).width > 610 || char === '\n') { text(x, row, y + count * (size * 1.55), size); row = ''; if (++count >= maxLines) return; } if (char !== '\n') row += char; }
    if (row) text(x, row, y + count * (size * 1.55), size);
  };
  const drop = t => { if (t) { t.dispose(); textures.delete(t); } };
  const replace = (mesh, t) => { const old = mesh.material.map; mesh.material.map = t; mesh.material.needsUpdate = true; if (old !== t) drop(old); };
  const setBusy = value => { busy = value; onBusy(value); host.dataset.busy = String(value); };
  const tween = (duration, update) => new Promise(resolve => {
    if (animation) { cancelAnimationFrame(animation.id); animation.resolve(); }
    const job = { id: 0, resolve }; animation = job; const start = performance.now();
    const step = now => { if (disposed) return resolve(); const t = reduced.matches ? 1 : Math.min(1, (now - start) / duration); update(t * t * (3 - 2 * t)); invalidate(); if (t < 1) job.id = requestAnimationFrame(step); else { animation = null; resolve(); } }; step(start);
  });
  const setOpen = async value => {
    if (busy || disposed || opened === value) return;
    setBusy(true); opened = value; fit();
    const from = { angle: cover.rotation.y, x: book.position.x, rx: book.rotation.x, ry: book.rotation.y, rz: book.rotation.z };
    await tween(780, t => { cover.rotation.y = THREE.MathUtils.lerp(from.angle, value ? -Math.PI : 0, t); book.position.x = THREE.MathUtils.lerp(from.x, value ? 1.32 : 0, t); book.rotation.set(THREE.MathUtils.lerp(from.rx, value ? 0 : -.12, t), THREE.MathUtils.lerp(from.ry, value ? 0 : -.38, t), THREE.MathUtils.lerp(from.rz, value ? 0 : -.045, t)); });
    if (!disposed) { host.dataset.open = String(value); setBusy(false); }
  };
  const setEvent = async (ev, number, animate = false, direction = 1) => {
    const id = ++requestId; setBusy(true);
    const l = makeCanvas(), r = makeCanvas();
    text(l.x, 'MY BIGCAT PASSPORT', 104, 24); text(l.x, name, 157, 31);
    text(r.x, 'LITTLE MOMENTS, BIG LOVE', 104, 24);
    if (ev) {
      const art = ev.earned ? await image(eventStampArt(ev) || ev.cover) : null;
      if (disposed || id !== requestId) return;
      if (art) contain(l.x, art, 125, 215, 518, 518);
      else { l.x.strokeStyle = '#c9b698'; l.x.setLineDash([12, 10]); l.x.strokeRect(185, 285, 398, 350); l.x.setLineDash([]); text(l.x, ev.phase === 'upcoming' ? 'NEXT MEMORY' : 'MISSED MEMORY', 475, 32); }
      text(l.x, eventDate(ev).long, 805, 28); lines(l.x, ev.title, 866, 2, 34);
      const unlock = ev.earned ? ev.unlock : null;
      if (unlock?.type === 'image' && unlock.src) { const im = await image(unlock.src); if (im) contain(r.x, im, 85, 170, 598, 440); else text(r.x, 'ภาพยังโหลดไม่สำเร็จ', 390, 30); }
      else { text(r.x, '♡', 290, 105, '#c38993'); lines(r.x, ev.earned ? 'อีกหนึ่งวันดี ๆ\nที่เราได้เจอกัน' : 'เก็บวันดี ๆ\nไว้ด้วยกัน', 400, 2, 44); }
      if (unlock?.type === 'text') lines(r.x, unlock.text, 660, 3, 28);
      else if (unlock?.type === 'audio') text(r.x, 'เปิดรายละเอียดเพื่อฟังเสียงจากงาน', 675, 25);
      else text(r.x, 'Small moments. Big happiness.', 670, 27);
      const extras = ev.earned ? (ev.extras || []).slice(0, 3) : [];
      const images = await Promise.all(extras.map(s => image(SPECIAL_STAMP_ART[s.kind])));
      images.forEach((im, i) => contain(r.x, im, 100 + i * 194, 770, 175, 175));
      if ((ev.extras?.length || 0) > 3 && ev.earned) text(r.x, 'ดูของสะสมทั้งหมดในรายละเอียด', 982, 23);
    } else { text(l.x, 'YOUR FIRST MEMORY', 400, 36); text(l.x, 'รอวันแรกที่เราได้เจอกัน', 490, 34); text(r.x, 'More good days are on their way.', 480, 30); }
    text(l.x, String(number * 2 + 1).padStart(2, '0'), 1000, 20);
    if (disposed || id !== requestId) return;
    const lt = texture(l.c), rt = texture(r.c);
    if (animate && opened && right.material.map) {
      leaf.visible = true; leaf.rotation.y = direction > 0 ? 0 : -Math.PI;
      leafFront.material.map = direction > 0 ? right.material.map : rt;
      leafBack.material.map = direction > 0 ? lt : left.material.map;
      leafFront.material.needsUpdate = leafBack.material.needsUpdate = true;
      await tween(540, t => { leaf.rotation.y = direction > 0 ? -Math.PI * t : -Math.PI * (1 - t); });
    }
    if (disposed || id !== requestId) { drop(lt); drop(rt); return; }
    leaf.visible = false; leafFront.material.map = leafBack.material.map = null;
    replace(left, lt); replace(right, rt); invalidate(); setBusy(false);
  };
  let pointer = null;
  const down = e => { if (busy || pointer) return; pointer = { id: e.pointerId, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY }; canvas.setPointerCapture(e.pointerId); };
  const move = e => { if (!pointer || pointer.id !== e.pointerId || busy) return; if (!opened) { book.rotation.y += (e.clientX - pointer.x) * .009; book.rotation.x = THREE.MathUtils.clamp(book.rotation.x + (e.clientY - pointer.y) * .005, -.65, .65); invalidate(); } pointer.x = e.clientX; pointer.y = e.clientY; };
  const up = e => { if (!pointer || pointer.id !== e.pointerId) return; const dx = e.clientX - pointer.startX, dy = e.clientY - pointer.startY; pointer = null; if (canvas.hasPointerCapture(e.pointerId)) canvas.releasePointerCapture(e.pointerId); if (opened && !busy && Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.4) onTurn(dx < 0 ? 1 : -1); };
  const cancel = () => { pointer = null; };
  canvas.addEventListener('pointerdown', down); canvas.addEventListener('pointermove', move); canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', cancel);
  const lost = e => { e.preventDefault(); onError('ระบบกราฟิกหยุดทำงาน กรุณาโหลดหน้าใหม่ หรือเปิดโหมดอ่านปกติ'); };
  canvas.addEventListener('webglcontextlost', lost);
  const visible = () => { if (!document.hidden) invalidate(); };
  document.addEventListener('visibilitychange', visible);
  // Start assets asynchronously so disposal is available immediately on navigation.
  (async () => {
    try {
      const images = await Promise.all(['/images/bigcat-mark-pink.webp', ...['nobi', 'boota', 'shiba'].map(k => `/images/cozy/${k}-personality-v2.webp`)].map(image));
      if (disposed) return;
      const f = makeCanvas(); f.x.fillStyle = '#ead3bd'; f.x.fillRect(0, 0, 768, 1060); f.x.strokeStyle = '#ae8651'; f.x.lineWidth = 3; f.x.strokeRect(35, 35, 698, 990); f.x.strokeRect(45, 45, 678, 970);
      contain(f.x, images[0], 285, 75, 198, 130); text(f.x, 'PASSPORT', 282, 62, '#8f683d'); text(f.x, 'SMALL MOMENTS · BIG HAPPINESS', 336, 21);
      images.slice(1).forEach((im, i) => { const x = 67 + i * 216; f.x.save(); f.x.beginPath(); f.x.ellipse(x + 101, 557, 100, 157, 0, 0, Math.PI * 2); f.x.fillStyle = ['#f2d6dc', '#dbc5df', '#d4e4ef'][i]; f.x.fill(); f.x.clip(); contain(f.x, im, x, 407, 202, 306); f.x.restore(); f.x.strokeStyle = '#af894f'; f.x.lineWidth = 5; f.x.beginPath(); f.x.ellipse(x + 101, 557, 100, 157, 0, 0, Math.PI * 2); f.x.stroke(); });
      text(f.x, name, 818, 38); text(f.x, 'A KINDER WORLD WITH BIGCAT', 925, 21);
      replace(front, texture(f.c)); const b = makeCanvas(); contain(b.x, images[0], 264, 345, 240, 180); text(b.x, 'GOOD DAYS, KEPT FOREVER.', 650, 26); replace(back, texture(b.c)); invalidate();
    } catch { if (!disposed) onError('โหลดภาพปกไม่สำเร็จ ลองโหลดหน้าใหม่อีกครั้ง'); }
  })();
  return {
    setOpen, setEvent,
    reset: () => { if (busy) return; book.rotation.set(opened ? 0 : -.12, opened ? 0 : -.38, opened ? 0 : -.045); fit(); },
    dispose: () => {
      disposed = true; requestId++; if (frame) cancelAnimationFrame(frame); if (animation) { cancelAnimationFrame(animation.id); animation.resolve(); }
      observer.disconnect(); document.removeEventListener('visibilitychange', visible);
      canvas.removeEventListener('pointerdown', down); canvas.removeEventListener('pointermove', move); canvas.removeEventListener('pointerup', up); canvas.removeEventListener('pointercancel', cancel); canvas.removeEventListener('webglcontextlost', lost);
      scene.traverse(object => { object.geometry?.dispose(); if (object.material) { const mats = Array.isArray(object.material) ? object.material : [object.material]; mats.forEach(m => m.dispose()); } });
      textures.forEach(t => t.dispose()); textures.clear(); cache.clear(); renderer.dispose(); canvas.remove();
    },
  };
}
