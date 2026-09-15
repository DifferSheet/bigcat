'use client';
import React, { useEffect, useState } from 'react';
import { Link } from '../lib/nav.jsx';
import { Notice } from '../components/EventShell.jsx';
import { Icon, PageLoader, Modal } from '../components/ui.jsx';
import { api, getAdminKey } from '../lib/api.js';
import { baht } from '../lib/format.js';
import RichText from '../components/RichText.jsx';
import ImageStrip from '../components/ImageStrip.jsx';

const ORDER_STATUS = [['pending', 'รอชำระ'], ['paid', 'ชำระแล้ว'], ['packing', 'กำลังแพ็ก'], ['shipped', 'จัดส่งแล้ว'], ['completed', 'สำเร็จ'], ['cancelled', 'ยกเลิก']];
const label = (s) => ORDER_STATUS.find(x => x[0] === s)?.[1] || s;
const FALLBACK_IMG = '/images/bigcat-merch.jpg';

/* ---------- จ่าหน้าพัสดุ: เลือกออเดอร์ → พิมพ์ (ผู้ส่งจากตั้งค่า · ผู้รับจากออเดอร์) ---------- */
function LabelSheet({ orders, sender, onClose }) {
  useEffect(() => { document.body.classList.add('print-labels'); return () => document.body.classList.remove('print-labels'); }, []);
  const noSender = !sender?.name && !sender?.address;
  return <div className="label-overlay" role="dialog" aria-label="จ่าหน้าพัสดุ">
    <div className="label-toolbar">
      <div><strong>จ่าหน้าพัสดุ {orders.length} ชิ้น</strong><small className="muted"> · A4 แนวตั้ง 4 ใบ/หน้า</small>{noSender && <small className="warn-text"> · ยังไม่ได้ตั้งค่าผู้ส่ง (แท็บ ตั้งค่า)</small>}</div>
      <div className="form-actions"><button className="button dark small" onClick={() => window.print()}>พิมพ์ <Icon name="check" size={14} /></button><button className="button ghost small" onClick={onClose}>ปิด</button></div>
    </div>
    <div className="label-sheet">{orders.map(o => <article key={o.id} className="ship-label">
      <div className="label-from"><span className="label-tag">ผู้ส่ง / FROM</span><strong>{sender?.name || 'BIGCAT'}</strong><p>{sender?.address}</p>{sender?.phone && <p>โทร {sender.phone}</p>}</div>
      <div className="label-to"><span className="label-tag">ผู้รับ / TO</span><strong>{o.name}</strong><p>{o.address}</p><p>โทร {o.phone}</p></div>
      <div className="label-foot"><span className="code">{o.code}</span><span>{o.items.map(i => `${i.name}${i.variant_name ? ` (${i.variant_name})` : ''} ×${i.qty}`).join(' · ')}</span>{o.carrier && <span>{o.carrier} {o.tracking_no}</span>}</div>
    </article>)}</div>
  </div>;
}

/* ---------- ออเดอร์ ---------- */
function Orders({ settings, onMsg }) {
  const [filter, setFilter] = useState('pending');
  const [orders, setOrders] = useState(null);
  const [summary, setSummary] = useState(null);
  const [edit, setEdit] = useState({});
  const [selected, setSelected] = useState([]);   // id ที่ติ๊กไว้พิมพ์จ่าหน้า
  const [slipView, setSlipView] = useState(null); // ออเดอร์ที่กำลังดูสลิป
  const [labels, setLabels] = useState(false);
  const load = () => Promise.all([api(`/admin/shop/orders?status=${filter}`, { admin: true }), api('/admin/shop/orders/summary', { admin: true })]).then(([o, s]) => { setOrders(o); setSummary(s); }).catch(e => onMsg(e.message));
  useEffect(() => { setOrders(null); setSelected([]); load(); }, [filter]);
  const toggle = (id) => setSelected(sel => sel.includes(id) ? sel.filter(x => x !== id) : [...sel, id]);
  const shippable = (orders || []).filter(o => o.delivery === 'ship' && !['cancelled'].includes(o.status));
  const selectedOrders = (orders || []).filter(o => selected.includes(o.id));
  const patch = async (o, body) => { onMsg(''); try { await api(`/admin/shop/orders/${o.id}`, { method: 'PATCH', body, admin: true }); onMsg(`อัปเดต ${o.code} แล้ว`, 'ok'); load(); } catch (e) { onMsg(e.message); } };
  const exportCsv = async () => { const res = await fetch('/api/admin/shop/orders.csv', { headers: { 'x-admin-key': getAdminKey() } }); const url = URL.createObjectURL(await res.blob()); const a = document.createElement('a'); a.href = url; a.download = 'orders.csv'; a.click(); URL.revokeObjectURL(url); };

  return <>
    {summary && <div className="stat-tiles">
      <div><span className="eyebrow">รอชำระ</span><strong>{summary.pending}</strong></div>
      <div><span className="eyebrow">รอแพ็ก</span><strong>{summary.paid}</strong><small>กำลังแพ็ก {summary.packing}</small></div>
      <div><span className="eyebrow">ส่งแล้ว</span><strong>{summary.shipped}</strong></div>
      <div><span className="eyebrow">ยอดขาย (ชำระแล้ว)</span><strong>{baht(summary.revenue)}</strong><small>{summary.total} ออเดอร์</small></div>
    </div>}
    <div className="tabs-row"><div className="filter-tabs">{[['pending', 'รอชำระ'], ['paid', 'รอแพ็ก'], ['packing', 'กำลังแพ็ก'], ['shipped', 'ส่งแล้ว'], ['all', 'ทั้งหมด']].map(([k, l]) => <button key={k} className={filter === k ? 'active' : ''} onClick={() => setFilter(k)}>{l}</button>)}</div><div className="form-actions"><button className="button ghost small" onClick={exportCsv}>CSV ↓</button>{shippable.length > 0 && <><label className="check check-all"><input type="checkbox" checked={selected.length === shippable.length} onChange={e => setSelected(e.target.checked ? shippable.map(o => o.id) : [])} /> เลือกทั้งหมด ({shippable.length})</label><button className="button dark small" disabled={!selected.length} onClick={() => setLabels(true)}>พิมพ์จ่าหน้า {selected.length ? `(${selected.length})` : ''}</button></>}</div></div>
    {!orders ? <PageLoader /> : orders.length === 0 ? <p className="muted">ไม่มีออเดอร์ในสถานะนี้</p> : <div className="order-admin-list">{orders.map(o => {
      const e = edit[o.id] || { carrier: o.carrier || settings?.carriers?.[0] || '', tracking_no: o.tracking_no || '' };
      return <div key={o.id} className={`order-admin ${o.status}`}>
        <div className="order-admin-head">
          <div>{o.delivery === 'ship' && o.status !== 'cancelled' && <input type="checkbox" className="pick" checked={selected.includes(o.id)} onChange={() => toggle(o.id)} aria-label={`เลือก ${o.code} พิมพ์จ่าหน้า`} />}<strong className="code">{o.code}</strong>{o.lineLinked ? <span className="mini-tag">LINE</span> : null}<span className={`status-pill ${o.status === 'cancelled' ? 'full' : o.status === 'pending' ? 'muted' : 'open'}`}>{label(o.status)}</span></div>
          <span className="muted">{o.created_at} · {o.delivery === 'pickup' ? 'รับหน้างาน' : 'ส่งไปรษณีย์'}</span>
          <strong>{baht(o.total)}</strong>
        </div>
        <div className="order-admin-body">
          <div><p><strong>{o.name}</strong> · {o.phone}{o.email ? ` · ${o.email}` : ''}</p><p className="muted">{o.delivery === 'pickup' ? 'รับหน้างาน' : o.address}</p>{o.note && <p className="muted">หมายเหตุ: {o.note}</p>}</div>
          <ul className="mini-lines compact with-thumbs">{o.items.map(i => <li key={i.id}><img src={i.image || FALLBACK_IMG} alt="" /><span>{i.name}{i.variant_name ? ` · ${i.variant_name}` : ''} × {i.qty}</span><strong>{baht(i.price * i.qty)}</strong></li>)}</ul>
          <div className="order-admin-pay">{o.slip_path ? <button type="button" className="slip-thumb" onClick={() => setSlipView(o)} aria-label={`ดูสลิป ${o.code}`}><img src={o.slip_path} alt="" /><span>ดูสลิป</span></button> : <span className="muted">ยังไม่มีสลิป</span>}{o.verify_note && <small className={o.verified_at ? 'ok-text' : ''}>{o.verify_note}</small>}</div>
        </div>
        <div className="order-admin-actions">
          {o.status === 'pending' && <><button className="button dark small" onClick={() => patch(o, { status: 'paid' })}>ยืนยันชำระเงิน</button><button className="link-button" onClick={() => patch(o, { status: 'cancelled' })}>ยกเลิก (คืนสต็อก)</button></>}
          {o.status === 'paid' && <button className="button dark small" onClick={() => patch(o, { status: 'packing' })}>เริ่มแพ็ก</button>}
          {(o.status === 'packing' || o.status === 'paid') && o.delivery === 'ship' && <div className="ship-row"><select value={e.carrier} onChange={ev => setEdit({ ...edit, [o.id]: { ...e, carrier: ev.target.value } })}>{(settings?.carriers || []).map(c => <option key={c}>{c}</option>)}</select><input placeholder="เลขพัสดุ" value={e.tracking_no} onChange={ev => setEdit({ ...edit, [o.id]: { ...e, tracking_no: ev.target.value } })} /><button className="button dark small" disabled={!e.tracking_no} onClick={() => patch(o, { status: 'shipped', carrier: e.carrier, tracking_no: e.tracking_no })}>ส่งแล้ว + แจ้งลูกค้า</button></div>}
          {(o.status === 'packing' || o.status === 'paid') && o.delivery === 'pickup' && <button className="button dark small" onClick={() => patch(o, { status: 'completed' })}>รับของแล้ว</button>}
          {o.status === 'shipped' && <><span className="muted">{o.carrier} {o.tracking_no}</span><button className="button ghost small" onClick={() => patch(o, { status: 'completed' })}>ปิดงาน</button></>}
          <Link className="link-button" to={`/order/${o.code}`} target="_blank">หน้าลูกค้า ↗</Link>
        </div>
      </div>;
    })}</div>}
    {slipView && <Modal title={`สลิป ${slipView.code} · ${baht(slipView.total)}`} wide onClose={() => setSlipView(null)}>
      <img className="slip-full" src={slipView.slip_path} alt={`สลิปโอนเงินของ ${slipView.name}`} />
      <div className="detail-strip">{slipView.verify_note || 'ยังไม่ได้ตรวจอัตโนมัติ'}</div>
      <div className="form-actions">
        {slipView.status === 'pending' && <button className="button dark small" onClick={() => { patch(slipView, { status: 'paid' }); setSlipView(null); }}>ยืนยันชำระเงิน</button>}
        <a className="link-button" href={slipView.slip_path} target="_blank" rel="noreferrer">เปิดไฟล์เต็ม ↗</a>
      </div>
    </Modal>}
    {labels && <LabelSheet orders={selectedOrders} sender={settings?.sender} onClose={() => setLabels(false)} />}
  </>;
}

/* ---------- สินค้า ---------- */
const emptyProduct = { name: '', name_th: '', category: 'ของสะสม', price: '', compare_price: '', stock: 0, status: 'active', featured: false, sort: 0, description: '', variants: [] };

function ProductForm({ initial, onSaved, onCancel, onMsg }) {
  const [p, setP] = useState({ ...emptyProduct, ...initial, variants: (initial?.variants || []).map(v => ({ id: v.id, name: v.name, price_delta: v.price_delta, stock: v.stock, sku: v.sku || '', image: v.image || null })) });
  // ภาพสินค้าเรียงลำดับ — ภาพแรก = รูปหลัก · รายการเป็น path เดิม หรือ File ใหม่
  const [images, setImages] = useState((initial?.images?.length ? initial.images : [initial?.image]).filter(Boolean));
  const gallery = images.filter(x => typeof x === 'string');   // ให้ตัวเลือกเลือกรูปประจำได้เฉพาะภาพที่บันทึกแล้ว
  const [busy, setBusy] = useState(false);
  const set = (k, v) => setP(x => ({ ...x, [k]: v }));
  const setVar = (i, k, v) => setP(x => ({ ...x, variants: x.variants.map((row, j) => j === i ? { ...row, [k]: v } : row) }));
  const submit = async (e) => {
    e.preventDefault(); setBusy(true); onMsg('');
    try {
      const files = images.filter(x => x instanceof File);
      const fd = new FormData(); fd.append('payload', JSON.stringify({ ...p, images: images.map(x => x instanceof File ? `file:${files.indexOf(x)}` : x) })); files.forEach(f => fd.append('gallery', f));
      const saved = await api(initial?.id ? `/admin/shop/products/${initial.id}` : '/admin/shop/products', { method: initial?.id ? 'PUT' : 'POST', body: fd, admin: true });
      onSaved(saved);
    } catch (err) { onMsg(err.message); } finally { setBusy(false); }
  };
  return <form className="booking-form product-form" onSubmit={submit}>
    <div className="two"><label>ชื่อสินค้า (EN)<input required value={p.name} onChange={e => set('name', e.target.value)} /></label><label>ชื่อไทย<input value={p.name_th} onChange={e => set('name_th', e.target.value)} /></label></div>
    <div className="two"><label>หมวด<input value={p.category} onChange={e => set('category', e.target.value)} list="cat-list" /><datalist id="cat-list"><option>ของสะสม</option><option>กระเป๋า</option><option>เสื้อผ้า</option></datalist></label><label>สถานะ<select value={p.status} onChange={e => set('status', e.target.value)}><option value="active">ขายอยู่</option><option value="hidden">ซ่อน</option><option value="soldout">หมด (แสดงแต่ซื้อไม่ได้)</option></select></label></div>
    <div className="three"><label>ราคา<input type="number" min="0" required value={p.price} onChange={e => set('price', e.target.value)} /></label><label>ราคาเดิม (ขีดฆ่า)<input type="number" min="0" value={p.compare_price || ''} onChange={e => set('compare_price', e.target.value)} /></label><label>สต็อก {p.variants.length > 0 && <small>(นับที่ตัวเลือกแทน)</small>}<input type="number" min="0" value={p.stock} disabled={p.variants.length > 0} onChange={e => set('stock', e.target.value)} /></label></div>
    <label className="rt-label">รายละเอียดสินค้า <small>(ตัวหนา ตัวเอียง รายการ ใช้ปุ่มด้านบนได้)</small>
      <RichText value={p.description || ''} onChange={v => set('description', v)} rows={8} />
    </label>
    <div className="gallery-edit">
      <span className="file-drop-label">รูปสินค้า <small>(ภาพแรก = รูปหลักบนการ์ด · ที่เหลือเป็นแกลเลอรีในหน้าสินค้า · ลากสลับได้ · สูงสุด 12)</small></span>
      <ImageStrip images={images} onChange={setImages} max={12} />
      {images.some(x => x instanceof File) && <small className="muted">ภาพใหม่จะเลือกเป็นรูปประจำตัวเลือกได้หลังกดบันทึก</small>}
    </div>
    <label className="check"><input type="checkbox" checked={!!p.featured} onChange={e => set('featured', e.target.checked)} /> แสดงบนหน้าแรก</label>
    <div className="variants-edit">
      <div className="ev-section-head"><span className="eyebrow">ตัวเลือก (ไซส์ / สี / แบบ) <small>— ตัวเลือกที่เป็นสี/แบบ ให้กดเลือกรูปประจำตัวเลือกด้วย ลูกค้าจะได้เห็นว่าเลือกอะไรอยู่ · ไซส์ไม่ต้อง</small></span><button type="button" className="link-button" onClick={() => set('variants', [...p.variants, { name: '', price_delta: 0, stock: 0, sku: '', image: null }])}>+ เพิ่มตัวเลือก</button></div>
      {p.variants.map((v, i) => <div key={i} className="variant-row"><input placeholder="ชื่อ เช่น M" required value={v.name} onChange={e => setVar(i, 'name', e.target.value)} /><input type="number" placeholder="+ราคา" value={v.price_delta} onChange={e => setVar(i, 'price_delta', e.target.value)} /><input type="number" min="0" placeholder="สต็อก" value={v.stock} onChange={e => setVar(i, 'stock', e.target.value)} /><input placeholder="SKU" value={v.sku} onChange={e => setVar(i, 'sku', e.target.value)} /><button type="button" className="link-button" onClick={() => set('variants', p.variants.filter((_, j) => j !== i))}>ลบ</button>
        {gallery.length > 0 && <div className="variant-img-pick"><button type="button" className={`vimg none ${!v.image ? 'active' : ''}`} onClick={() => setVar(i, 'image', null)} title="ไม่มีรูปประจำ (เช่น ไซส์)">ไม่มีรูป</button>{gallery.map(src => <button type="button" key={src} className={`vimg ${v.image === src ? 'active' : ''}`} onClick={() => setVar(i, 'image', src)} title="ใช้รูปนี้เป็นรูปประจำตัวเลือก"><img src={src} alt="" loading="lazy" /></button>)}</div>}
      </div>)}
    </div>
    <div className="form-actions"><button className="button dark small" disabled={busy}>{busy ? 'กำลังบันทึก…' : 'บันทึกสินค้า'}</button><button type="button" className="link-button" onClick={onCancel}>ยกเลิก</button></div>
  </form>;
}

function Products({ onMsg }) {
  const [list, setList] = useState(null);
  const [editing, setEditing] = useState(null); // null | 'new' | product
  const load = () => api('/admin/shop/products', { admin: true }).then(setList).catch(e => onMsg(e.message));
  useEffect(() => { load(); }, []);
  const remove = async (p) => { if (!confirm(`ลบ "${p.name}" ?`)) return; try { await api(`/admin/shop/products/${p.id}`, { method: 'DELETE', admin: true }); load(); } catch (e) { onMsg(e.message); } };
  const quick = async (p, payload) => { try { const fd = new FormData(); fd.append('payload', JSON.stringify({ ...p, ...payload })); await api(`/admin/shop/products/${p.id}`, { method: 'PUT', body: fd, admin: true }); load(); } catch (e) { onMsg(e.message); } };
  if (!list) return <PageLoader />;
  return <>
    <div className="tabs-row"><span className="muted">{list.length} รายการ</span><button className="button dark small" onClick={() => setEditing('new')}>+ เพิ่มสินค้า</button></div>
    {editing && <div className="admin-panel"><ProductForm initial={editing === 'new' ? null : editing} onMsg={onMsg} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); onMsg('บันทึกแล้ว', 'ok'); load(); }} /></div>}
    <div className="table-wrap"><table className="admin-table"><thead><tr><th></th><th>สินค้า</th><th>หมวด</th><th>ราคา</th><th>สต็อก</th><th>สถานะ</th><th></th></tr></thead><tbody>{list.map(p => <tr key={p.id} className={p.status === 'hidden' ? 'dim' : ''}>
      <td><img className="thumb" src={p.image || '/images/bigcat-merch.jpg'} alt="" /></td>
      <td><strong>{p.name}</strong><br /><small>{p.name_th}</small>{p.featured ? <span className="mini-tag ok">หน้าแรก</span> : null}</td>
      <td>{p.category}</td><td>{baht(p.price)}</td>
      <td>{p.variants.length ? <small>{p.variants.map(v => `${v.name}:${v.stock}`).join(' · ')}</small> : p.stock}{p.stock <= 5 && p.status === 'active' && <span className="mini-tag warn">ใกล้หมด</span>}</td>
      <td><select value={p.status} onChange={e => quick(p, { status: e.target.value })}><option value="active">ขายอยู่</option><option value="hidden">ซ่อน</option><option value="soldout">หมด</option></select></td>
      <td className="actions"><button className="button ghost small" onClick={() => setEditing(p)}>แก้ไข</button><button className="link-button" onClick={() => remove(p)}>ลบ</button></td>
    </tr>)}</tbody></table></div>
  </>;
}

/* ---------- ตั้งค่า ---------- */
function Settings({ settings, onSaved, onMsg }) {
  const [s, setS] = useState({ ...settings, carriersText: (settings.carriers || []).join(', ') });
  const [qr, setQr] = useState(null);
  const submit = async (e) => {
    e.preventDefault(); onMsg('');
    try { const fd = new FormData(); fd.append('payload', JSON.stringify({ ...s, carriers: s.carriersText.split(',').map(x => x.trim()).filter(Boolean) })); if (qr) fd.append('qr', qr); onSaved(await api('/admin/shop/settings', { method: 'PUT', body: fd, admin: true })); onMsg('บันทึกการตั้งค่าแล้ว', 'ok'); }
    catch (err) { onMsg(err.message); }
  };
  return <form className="booking-form" onSubmit={submit}>
    <div className="two"><label>ค่าส่ง (บาท)<input type="number" min="0" value={s.shippingFee} onChange={e => setS({ ...s, shippingFee: e.target.value })} /></label><label>ส่งฟรีเมื่อซื้อครบ (เว้นว่าง = ไม่มี)<input type="number" min="0" value={s.freeShippingOver || ''} onChange={e => setS({ ...s, freeShippingOver: e.target.value })} /></label></div>
    <label className="check"><input type="checkbox" checked={!!s.pickup?.enabled} onChange={e => setS({ ...s, pickup: { ...s.pickup, enabled: e.target.checked } })} /> เปิดให้เลือก "รับหน้างาน"</label>
    <label>ข้อความรับหน้างาน<input value={s.pickup?.label || ''} onChange={e => setS({ ...s, pickup: { ...s.pickup, label: e.target.value } })} /></label>
    <label>ขนส่งที่ใช้ (คั่นด้วย ,)<input value={s.carriersText} onChange={e => setS({ ...s, carriersText: e.target.value })} /></label>
    <h2>ผู้ส่งบนจ่าหน้าพัสดุ</h2>
    <div className="two"><label>ชื่อผู้ส่ง<input value={s.sender?.name || ''} onChange={e => setS({ ...s, sender: { ...s.sender, name: e.target.value } })} placeholder="BIGCAT" /></label><label>เบอร์ผู้ส่ง<input value={s.sender?.phone || ''} onChange={e => setS({ ...s, sender: { ...s.sender, phone: e.target.value } })} /></label></div>
    <label>ที่อยู่ผู้ส่ง<textarea rows={2} value={s.sender?.address || ''} onChange={e => setS({ ...s, sender: { ...s.sender, address: e.target.value } })} /></label>
    <div className="two"><label>ชื่อบัญชีรับเงิน<input value={s.payment?.accountName || ''} onChange={e => setS({ ...s, payment: { ...s.payment, accountName: e.target.value } })} /></label><label>เลข PromptPay (ถ้าไม่ใช้ QR)<input value={s.payment?.promptpay || ''} onChange={e => setS({ ...s, payment: { ...s.payment, promptpay: e.target.value } })} /></label></div>
    <label>รูป QR รับเงิน {s.payment?.qrImage && <small>(มีอยู่แล้ว)</small>}<input type="file" accept="image/*" onChange={e => setQr(e.target.files?.[0] || null)} /></label>
    <div className="form-actions"><button className="button dark small">บันทึก</button></div>
  </form>;
}

export default function ShopAdmin() {
  const [tab, setTab] = useState('orders');
  const [settings, setSettings] = useState(null);
  const [msg, setMsgRaw] = useState('');
  const [tone, setTone] = useState('error');
  const onMsg = (m, t = 'error') => { setMsgRaw(m); setTone(t); };
  useEffect(() => { api('/admin/shop/settings', { admin: true }).then(setSettings).catch(e => onMsg(e.message)); }, []);
  return <div className="admin-event">
    <div className="admin-event-head"><div><span className="eyebrow">SHOP</span><h2>ร้านค้า</h2></div><Link className="button ghost small" to="/shop" target="_blank">ดูหน้าร้าน ↗</Link></div>
    <div className="filter-tabs" style={{ marginBottom: 14 }}>{[['orders', 'ออเดอร์'], ['products', 'สินค้า'], ['settings', 'ตั้งค่า']].map(([k, l]) => <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{l}</button>)}</div>
    {msg && <Notice tone={tone === 'ok' ? 'info' : 'error'}>{msg}</Notice>}
    {tab === 'orders' && <Orders settings={settings} onMsg={onMsg} />}
    {tab === 'products' && <Products onMsg={onMsg} />}
    {tab === 'settings' && (settings ? <Settings settings={settings} onSaved={setSettings} onMsg={onMsg} /> : <PageLoader />)}
  </div>;
}
