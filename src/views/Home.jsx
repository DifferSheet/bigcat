'use client';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from '../lib/nav.jsx';
import { Icon, Paw, Flower, Modal, Logo } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { cart, useCart } from '../lib/cart.js';
import { eventDate } from '../lib/format.js';
import '@/home.css';
import '../cozy.css';
import '../housewarming.css';
import { useCozyMotion } from '../lib/cozy-motion.js';

const HERO = '/images/cozy/hero.png';
const MERCH = '/images/bigcat-merch.png';
const characterImage = id => `/images/cozy/${id}-personality-v2.png`;
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

const members = [
  { id: 'nobi', name: 'NOBI', thai: 'น้องโนบิ', tone: 'pink', icon: '♡', tag: 'Your kawaii idol', text: 'หวานคิคุ\nคาวาอิแบบไอดอล', detail: 'ไอดอลตัวน้อยของแก๊ง BigCat กับเดรสดอกไม้สีชมพู โบว์คู่ และท่ายกอุ้งมือข้างแก้มสุดคาวาอิ โนบิพร้อมส่งรอยยิ้มหวาน ๆ ให้ทุกวันของคุณสดใสขึ้น', likes: 'โบว์สีชมพู · โพสท่าคาวาอิ · ส่งยิ้มให้แฟนคลับ' },
  { id: 'boota', name: 'BOOTA', thai: 'น้องบูตะ', tone: 'yellow', icon: '✦', tag: 'Straight face, playful soul', text: 'หน้านิ่งกวน ๆ\nแต่ขี้เล่นที่สุด', detail: 'ใต้แว่นกลมสีทองและสูทม่วงลายทาง คือแมวขี้เล่นที่ชอบแกล้งทำหน้านิ่ง บูตะขยับแว่นนิด เอียงตัวหน่อย แล้วปล่อยมุกแบบไม่หลุดยิ้มให้เพื่อน ๆ หัวเราะกัน', likes: 'แกล้งเพื่อนเบา ๆ · มุกหน้านิ่ง · แว่นกลมคู่ใจ' },
  { id: 'shiba', name: 'SHIBA', thai: 'น้องชิบะ', tone: 'blue', icon: '✧', tag: 'A little pose, a lot of cool', text: 'หล่อเท่มีสไตล์\nแอบแอคนิด ๆ', detail: 'หนุ่มหล่อประจำแก๊งในแจ็กเก็ตทวีดฟ้าประดับมุกและกางเกงน้ำเงิน ชิบะชอบจัดปกเสื้อ ยืนเท่ ๆ แล้วส่งสายตามั่นใจให้กล้อง เห็นนิ่งแบบนี้ เรื่องโพสท่าไม่ยอมใครเลย', likes: 'สีฟ้า–น้ำเงิน · แต่งตัวเท่ · โพสท่าหน้ากล้อง' },
];
const photos = [
  { title: 'Good Days ♡', caption: 'โนบิกับดอกไม้ในวันสดใส', image: '/images/cozy/diary-nobi.png', tilt: -4 },
  { title: 'Better Together ♡', caption: 'บูตะกับมุมอ่านหนังสือแสนอบอุ่น', image: '/images/cozy/diary-boota.png', tilt: 2 },
  { title: 'Same Here ♡', caption: 'วันพักผ่อนของชิบะบนโซฟาตัวโปรด', image: '/images/cozy/diary-shiba.png', tilt: -2 },
];
const navItems = [['รู้จักแก๊ง', '#friends'], ['ตารางงาน', '#events'], ['กิจกรรม', '/events'], ['อัลบั้ม', '#moments']];

// เผยทีละส่วนเมื่อเลื่อนถึง — รันซ้ำเมื่อข้อมูลจาก API มาถึง เพื่อให้การ์ดที่เพิ่งเรนเดอร์ถูกสังเกตด้วย
function useReveal(deps) {
  useEffect(() => {
    const observer = new IntersectionObserver(entries => entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('is-visible'); observer.unobserve(e.target); } }), { threshold: 0.08 });
    document.querySelectorAll('.reveal:not(.is-visible)').forEach(el => observer.observe(el));
    return () => observer.disconnect();
  }, deps);
}

function SectionHead({ label, note, to }) {
  return <div className="hm-sec-head reveal"><span className="hm-label">{label}</span><span className="hm-line" />{note && (to ? <Link className="hm-note" to={to}>{note}</Link> : <span className="hm-note">{note}</span>)}</div>;
}

export default function Home({ initialEvents = [], initialProducts = [] }) {
  const navigate = useNavigate();
  const { count } = useCart();
  const [menu, setMenu] = useState(false);
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [albumIndex, setAlbumIndex] = useState(0);
  const [events, setEvents] = useState([]);
  const [products, setProducts] = useState([]);
  const [eventState, setEventState] = useState('loading');
  useCozyMotion();
  useReveal([events, products]);
  useEffect(() => {
    api('/events').then(list => { setEvents(list.filter(e => e.status !== 'ended').slice(0, 2)); setEventState('ready'); }).catch(() => setEventState('error'));
    api('/shop/products').then(list => { setProducts(list.filter(p => p.featured).concat(list.filter(p => !p.featured)).slice(0, 4)); cart.sync(list); }).catch(() => {});
  }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); } }, [toast]);
  useEffect(() => { if (!menu) return; const close = e => { if (e.key === 'Escape') setMenu(false); }; addEventListener('keydown', close); return () => removeEventListener('keydown', close); }, [menu]);
  const closeModal = () => setModal(null);
  const addToCart = (p) => { if (p.variants?.length) return navigate(`/shop/${p.slug}`); setToast(cart.add(p, null, 1) ? `เพิ่ม ${p.name} ลงตะกร้าแล้ว` : 'สินค้าหมดแล้ว'); };

  return <div className="hm hm-party-shell">
    <a className="skip-link" href="#main">ข้ามไปเนื้อหา</a>
    <header className="hm-header">
      <Link to="/" className="hm-logo" aria-label="Bigcat หน้าแรก"><Logo /></Link>
      <nav className={`hm-nav ${menu ? 'open' : ''}`} id="main-nav" aria-label="เมนูหลัก">
        {navItems.map(([label, href]) => href.startsWith('#') ? <a key={href} href={href} onClick={() => setMenu(false)}>{label}</a> : <Link key={href} to={href} onClick={() => setMenu(false)}>{label}</Link>)}
        <Link to="/shop" className="hm-nav-shop" onClick={() => setMenu(false)}>SHOP</Link>
      </nav>
      <div className="hm-nav-actions">
        <Link className="icon-button cart-button" to="/cart" aria-label={`ตะกร้า ${count} ชิ้น`}><Icon name="bag" size={22} />{count > 0 && <span className="cart-count">{count}</span>}</Link>
        <button className="icon-button hm-menu" aria-label={menu ? 'ปิดเมนู' : 'เปิดเมนู'} aria-expanded={menu} aria-controls="main-nav" onClick={() => setMenu(!menu)}><Icon name={menu ? 'close' : 'menu'} /></button>
      </div>
    </header>

    <main id="main">
      {/* ---------- HERO ---------- */}
      <section className="party-hero" aria-labelledby="hero-title">
        <picture className="party-scene">
          <source media="(max-width: 900px) and (orientation: portrait)" srcSet="/images/cozy/housewarming-fresh-mobile.png" />
          <img src="/images/cozy/housewarming-fresh-desktop.png" alt="โนบิตายิ้มข้างหนึ่งและอ้าปากยิ้มกว้าง พร้อมบูตะและชิบะในชุดตาม character sheet ทั้งสามมีอุ้งมือสี่นิ้ว กำลังเต้นฉลองเปิดบ้านไม้โทนอุ่น" fetchPriority="high" width="1672" height="941" data-cozy-depth="0.04" />
        </picture>
        <div className="party-light" aria-hidden="true" />
        <div className="party-sparkles" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ '--x': `${8 + (i * 23) % 85}%`, '--y': `${12 + (i * 17) % 70}%` }} />)}</div>
        <div className="party-copy">
          <span className="party-eyebrow">OUR NEW HOME · YOUR HAPPY PLACE</span>
          <h1 id="hero-title">ยินดีต้อนรับ<span>สู่บ้าน BigCat <i>♡</i></span></h1>
          <p>โนบิ บูตะ และชิบะ เตรียมความสุขไว้เต็มบ้าน<br />มาฉลองการเริ่มต้นใหม่ด้วยกันนะ</p>
          <a className="hm-btn" href="#friends">เข้าบ้านมารู้จักกัน <span>→</span></a>
          <span className="party-hand">Come on in,<br />you’re part of the family.</span>
        </div>
        <a className="party-scroll" href="#friends"><span>เรื่องราวของบ้านเรา</span><span aria-hidden="true">↓</span></a>
      </section>

      {/* ---------- CHARACTERS ---------- */}
      <section id="friends" className="hm-section">
        <SectionHead label="OUR CHARACTERS" note="THREE CATS · A BRIGHTER TOMORROW ♡" />
        <div className="hm-chars">{members.map((m, i) => <button key={m.id} className={`hm-char tone-${m.tone} reveal`} style={{ '--delay': `${i * 110}ms` }} onClick={() => setModal({ type: 'member', member: m })}>
          <div className="hm-char-img"><img src={characterImage(m.id)} alt={m.thai} loading="lazy" width="1024" height="1536" /></div>
          <div className="hm-char-text"><h3>{m.name}</h3><p>{m.text}</p><span className="hm-char-icon" aria-hidden="true">{m.icon}</span><span className="hm-more">VIEW MORE <b>→</b></span></div>
        </button>)}</div>
      </section>

      {/* ---------- EVENTS ---------- */}
      <section id="events" className="hm-section">
        <SectionHead label="UPCOMING EVENTS" note="ดูกิจกรรมทั้งหมด →" to="/events" />
        <div className="hm-events">
          <div className="hm-events-copy reveal"><h2>เจอกัน<br />เร็ว ๆ นี้ <i>♡</i></h2><p>มาพบกันในช่วงเวลา<br />พิเศษไปด้วยกัน</p></div>
          {events.length === 0 && <div className="hm-event-empty" role="status"><Flower /><p>{eventState === 'loading' ? 'กำลังดูว่านัดหน้าเราเจอกันที่ไหน…' : eventState === 'error' ? 'ยังโหลดตารางงานไม่ได้ในขณะนี้' : 'รอนัดหมายครั้งถัดไปของพวกเรา'}</p><Link to="/events">{eventState === 'error' ? 'ลองดูตารางงานอีกครั้ง' : 'ไปหน้ากิจกรรม'} →</Link></div>}
          {events.map((ev, i) => { const d = eventDate(ev); return <Link key={ev.slug} to={`/events/${ev.slug}`} className="hm-event reveal" style={{ '--delay': `${i * 120}ms` }}>
            <div className="hm-event-img"><img src={ev.cover || HERO} alt="" loading="lazy" /><span className="hm-date"><strong>{Number(d.day)}</strong>{TH_MONTHS[d.start.getMonth()]}</span></div>
            <div className="hm-event-body"><h3>{ev.title}</h3><p>{ev.subtitle || ev.description?.slice(0, 60)}</p><span className="hm-arrow" aria-hidden="true">→</span></div>
          </Link>; })}
        </div>
      </section>

      {/* ---------- MERCH ---------- */}
      <section id="shop" className="hm-section">
        <SectionHead label="MERCHANDISE" note="ไปที่ร้านค้า →" to="/shop" />
        <div className="hm-merch reveal">
          <div className="hm-merch-copy">
            <h2>Little things.<br />Big love. <i>♡</i></h2>
            <p>ของเล็ก ๆ ที่เก็บความสุข<br />ไว้ได้เสมอ</p>
            <Link className="hm-btn light" to="/shop">SHOP NOW <span>→</span></Link>
          </div>
          <div className="hm-merch-art"><img src={MERCH} alt="ภาพคอนเซ็ปต์กระเป๋าผ้า Bigcat และพวงกุญแจโนบิ บูตะ ชิบะ" loading="lazy" data-cozy-depth="0.025" /></div>
          <Flower className="hm-flower hm-flower-3" />
        </div>
        {products.length > 0 && <div className="hm-products">{products.map((p, i) => <article key={p.id} className="hm-product reveal" style={{ '--delay': `${i * 90}ms` }}>
          <Link to={`/shop/${p.slug}`} className="hm-product-img"><img src={p.image || MERCH} alt={p.name_th || p.name} loading="lazy" />{!p.available && <span className="hm-tag">หมดแล้ว</span>}</Link>
          <div className="hm-product-info"><div><h3>{p.name}</h3><p>{p.name_th}</p></div><div className="hm-product-buy"><span>฿{p.price.toLocaleString()}</span><button className="icon-button product-add" disabled={!p.available} onClick={() => addToCart(p)} aria-label={`เพิ่ม ${p.name} ลงตะกร้า`}><Icon name={p.variants?.length ? 'arrow' : 'plus'} size={18} /></button></div></div>
        </article>)}</div>}
      </section>

      {/* ---------- ALBUM ---------- */}
      <section id="moments" className="hm-section">
        <SectionHead label="PHOTO ALBUM" note="โมเมนต์ของพวกเรา" />
        <div className="hm-album">
          <div className="hm-album-copy reveal"><h2>โมเมนต์<br />ของพวกเรา <i>♡</i></h2><p>ช่วงเวลาเล็ก ๆ ที่อยากเก็บไว้<br />กับทุกคน</p></div>
          <div className="hm-polaroids">{photos.map((ph, i) => <button key={ph.title} className="hm-polaroid reveal" style={{ '--tilt': `${ph.tilt}deg`, '--delay': `${i * 120}ms` }} onClick={() => { setAlbumIndex(i); setModal({ type: 'album' }); }}><img src={ph.image} alt={ph.caption} loading="lazy" /><span>{ph.title}</span></button>)}</div>
          <div className="hm-sticky reveal"><span>ขอบคุณ<br />ที่อยู่ด้วยกัน<br />เสมอ</span><Flower className="hm-sticky-flower" /></div>
        </div>
      </section>
    </main>

    <footer className="hm-footer">
      <div className="hm-footer-brand"><Logo /><small>Small Cats. A Brighter Tomorrow.</small></div>
      <nav className="hm-footer-nav" aria-label="เมนูท้ายเว็บ">{navItems.map(([label, href]) => href.startsWith('#') ? <a key={href} href={href}>{label}</a> : <Link key={href} to={href}>{label}</Link>)}<Link to="/shop">SHOP</Link><Link to="/admin">ทีมงาน</Link></nav>
      <div className="hm-social">{[['instagram', 'Instagram'], ['music', 'TikTok'], ['facebook', 'Facebook'], ['youtube', 'YouTube']].map(([icon, label]) => <button key={label} aria-label={label} onClick={() => setModal({ type: 'social', label })}><Icon name={icon} size={18} /></button>)}</div>
      <span className="hm-hand hm-footer-hand">โลกนี้น่ารักขึ้น<br />เพราะมีพวกเรา</span>
    </footer>

    {toast && <div className="toast" role="status"><Icon name="check" />{toast} <Link to="/cart" className="toast-link">ดูตะกร้า →</Link></div>}
    {modal?.type === 'member' && <Modal title={`${modal.member.name} / ${modal.member.thai}`} onClose={closeModal}><div className={`hm-modal-portrait tone-${modal.member.tone}`}><img src={characterImage(modal.member.id)} alt={modal.member.thai} /></div><span className="eyebrow">{modal.member.tag}</span><p>{modal.member.detail}</p><div className="detail-strip"><Icon name="heart" />{modal.member.likes}</div></Modal>}
    {modal?.type === 'album' && <Modal title={photos[albumIndex].title} wide onClose={closeModal}><img className="album-full" src={photos[albumIndex].image} alt={photos[albumIndex].caption} /><div className="album-controls"><button className="icon-button" aria-label="ภาพก่อนหน้า" onClick={() => setAlbumIndex((albumIndex + photos.length - 1) % photos.length)}>←</button><p>{photos[albumIndex].caption}<small>{albumIndex + 1} / {photos.length}</small></p><button className="icon-button" aria-label="ภาพถัดไป" onClick={() => setAlbumIndex((albumIndex + 1) % photos.length)}>→</button></div></Modal>}
    {modal?.type === 'social' && <Modal title={`BIGCAT on ${modal.label}`} onClose={closeModal}><div className="social-modal-paw"><Paw /></div><p>เตรียมพบกับเรื่องราวน่ารัก ๆ ของแก๊ง Bigcat บน {modal.label}</p><div className="detail-strip">จะเพิ่มลิงก์บัญชีทางการก่อนเปิดเว็บไซต์</div></Modal>}
  </div>;
}
