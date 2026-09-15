'use client';
import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from '../lib/nav.jsx';
import { Icon, Flower, Modal, Logo, Tagged } from '../components/ui.jsx';
import { api } from '../lib/api.js';
import { cart } from '../lib/cart.js';
import { SiteHeader, SiteFooter } from '../components/EventShell.jsx';
import { SOCIALS, SocialRow } from '../components/Social.jsx';
import { eventDate } from '../lib/format.js';
import '@/home.css';
import '../cozy.css';
import '../housewarming.css';
import { useCozyMotion } from '../lib/cozy-motion.js';

const HERO = '/images/cozy/hero.webp';
const MERCH = '/images/bigcat-merch.jpg';
const MERCH_DISPLAY = '/images/bigcat-merch-pink-v4.webp';
const characterImage = id => `/images/cozy/${id}-personality-v2.webp`;
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];

// ตัวละคร — กติกาแบรนด์: tag อังกฤษนำ · ไทยตาม · บอกว่าทำอะไรจริง/เจอได้ที่ไหน · ห้ามคำต้องห้ามของแบรนด์ (ดูใบสั่งแก้ข้อความ)
const members = [
  { id: 'nobi', name: 'NOBI', thai: 'น้องโนบิ', tone: 'pink', icon: '♡', tag: 'The little voice of the city', text: 'ร้องสดทุกเพลง\nซ้อมทุกวันตอนที่ไม่มีใครดู',
    alt: 'น้องโนบิ ลูกแมวสีครีมในเดรสดอกไม้สีชมพู ยกอุ้งมือข้างแก้มยิ้มให้กล้อง',
    detail: 'ลูกแมวตัวเล็กที่สุดของแก๊ง แต่เสียงดังที่สุด — โนร้องสดจริงทุกเพลง ไม่เคยลิปซิงค์ เกือบหนึ่งปีก่อนโนเริ่มร้องริมถนนเยาวราชโดยไม่มีใครหยุดฟัง วันนี้ทุกเสาร์มีมัม ๆ มายืนรอ และเสาร์ที่ 26 กันยานี้คือครั้งแรกในร่างใหม่ที่ตลาดเลียบด่วนแดนเนรมิต — โนยังเป็นโนคนเดิมนะคะ แต่ซ้อมมาให้ฟังเยอะกว่าเดิม',
    likes: 'ร้องสดทุกเพลง · ซ้อมทุกวัน · เจอกันได้ฟรีทุกเสาร์', socials: 'nobi',
    resume: {
      headline: 'ลูกแมวน้อยมหัศจรรย์ที่มาพร้อมเสียงหวานจับใจ',
      about: 'ความฝันของโนบิคือเป็นหัวจ่ายพลังงานความสุข เปลี่ยนวันร้าย ๆ ให้เป็นวันที่ดีด้วยเสียงของเธอ ตำนานเล่าว่าใครได้ยินจะถูกสะกดราวกับต้องมนต์ ทุกอย่างหยุดนิ่ง ณ เวลานั้น และเสียงนี้ช่วยเยียวยาหัวใจจากความเจ็บปวด เหนื่อยล้า และวันที่ไม่เป็นดั่งใจ ให้ความอบอุ่นและกำลังใจกลับมาทุกครั้งที่ได้ฟัง เสมือนถูกชุบชีวิตขึ้นใหม่',
      facts: [['อายุ', '7 ปี'], ['นิสัย', 'หัวใจงดงาม สดใสร่าเริงทุกวัน'], ['เวลาว่าง', 'วาดรูป · ซ้อมเต้น · ฝึกร้องเพลง'], ['ของโปรด', 'ขนมปัง และผลไม้ทุกชนิด']],
      skills: ['ร้องเพลง (ร้องสดทุกเพลง)', 'เต้น', 'วาดรูป', 'เยียวยาหัวใจด้วยเสียง'],
      quote: 'เกิดมาเพื่อสร้างรอยยิ้มและพลังงานดี ๆ ให้ผู้คนบนโลก',
    } },
  { id: 'boota', name: 'BOOTA', thai: 'น้องบูตะ', tone: 'yellow', icon: '✦', tag: 'Straight face. Biggest heart.', text: 'หน้านิ่งที่สุดในแก๊ง\nแต่ใจใหญ่ที่สุดในแก๊ง',
    alt: 'น้องบูตะ แมวดำแว่นกลมสีทอง สูทม่วงลายทาง ทำหน้านิ่ง',
    detail: 'พี่ใหญ่แว่นกลมสีทองที่ไม่เคยหลุดยิ้ม แต่เป็นคนแต่งเพลงให้โนบิร้อง และเป็น «มหาบูตะ» ที่พามัมป๊าไปทำบุญทุกเข้าพรรษา มุกหน้านิ่งของบูตะทำให้ทั้งแก๊งหัวเราะโดยที่ตัวเองไม่ขยับคิ้วเลยสักนิด',
    likes: 'แต่งเพลงให้โนบิ · พาไปทำบุญ · มุกหน้านิ่ง', socials: 'boota',
    resume: {
      headline: 'แมวสู้ชีวิตที่มาพร้อมความแข็งแกร่ง และเป็นนักสู้ตัวจริง',
      about: 'บูตะทำทุกอย่างสุดหัวใจ จึงเป็นตัวแทนของความพยายามและการไม่ยอมแพ้ต่อโชคชะตา เขาเชื่อว่าไม่ว่าต้นทุนชีวิตจะเป็นแบบไหน ความพยายาม ความสามารถ และสติปัญญาจะพาเราฝ่าทุกอุปสรรคไปได้ ใครได้พบต่างเล่าว่าเขามีพลังวิเศษให้กำลังใจในการต่อสู้ชีวิต และอยู่บนโลกที่โหดร้ายนี้ได้แบบชิล ๆ โดยไม่หวั่นเกรงสิ่งใด',
      facts: [['อายุ', '7 ปี'], ['นิสัย', 'หัวใจแข็งแกร่งเกินแมวและมนุษย์ทั่วไป'], ['มุมมอง', 'มองเรื่องโชคร้ายเป็นความตลกของชีวิต'], ['คำสัญญา', '«เราจะอยู่เพื่อกัน» — แพชชั่นของการมีชีวิตอยู่']],
      skills: ['แต่งเพลงรัก', 'เพลงแร็ป', 'กลอน', 'เล่นตลก', 'อินฟลูเอนเซอร์', 'พิธีกร', 'นักพูดให้กำลังใจ'],
      quote: 'เราจะอยู่เพื่อกัน',
    } },
  { id: 'shiba', name: 'SHIBA', thai: 'น้องชิบะ', tone: 'blue', icon: '✧', tag: 'Quiet. Cool. Always in frame.', text: 'พูดน้อยที่สุด\nแต่รูปสวยทุกใบ',
    alt: 'น้องชิบะ แมวหนุ่มในแจ็กเก็ตทวีดสีฟ้า ยืนจัดปกเสื้อ',
    detail: 'หนุ่มสายเท่ในแจ็กเก็ตทวีดสีฟ้า ชิบะพูดน้อยกว่าทุกคนในแก๊ง แต่พอกล้องหันมาเมื่อไหร่ ปกเสื้อจัดเรียบร้อย สายตามั่นใจ และท่าโพสไม่เคยซ้ำ — ถ้าเจอชิบะยืนนิ่ง ๆ อยู่ข้างเวที นั่นคือเขากำลังเลือกมุมที่ดีที่สุดให้คุณถ่าย',
    likes: 'โพสท่าหน้ากล้อง · สีฟ้า–น้ำเงิน · เท่แบบไม่พูด', socials: null,
    resume: {
      headline: 'แมวหล่อ นิสัยดี และมีจิตใจงดงาม — ต้นแบบของ Good Boy',
      about: 'ตาโต คิ้วเข้ม สีตัวเทาอ่อน จมูกชมพูหวานละมุน ชิบะฉลาดหลักแหลม สุภาพเรียบร้อย และอบอุ่นมาก ๆ คือความสดใสและความอุ่นใจของทุกคน แค่ปรากฏตัวก็ทำให้มนุษย์หลงรักได้ง่าย ๆ และเขายึดมั่นว่าจะไม่สร้างความเดือดร้อนใด ๆ ให้ผู้คนบนโลกโดยเด็ดขาด',
      facts: [['อายุ', '7 ปี'], ['เพื่อนสนิท', 'บูตะ และโนบิ'], ['ชอบ', 'นอน · เต้น · ปลีกวิเวกในป่าหรือที่เงียบสงบ'], ['จุดเด่น', 'ตาโต คิ้วเข้ม จมูกชมพู']],
      skills: ['เต้น', 'โพสท่าหน้ากล้อง', 'เป็น Good Boy ตัวอย่างของแมวทุกตัว'],
      quote: 'จะไม่สร้างความเดือดร้อนให้ใครบนโลกนี้เด็ดขาด',
    } },
];
// Illustrated hobby moments, not documentary event photographs.
const photos = [
  { title: 'A little color', short: 'ค่อย ๆ เติมสีให้วันธรรมดา', caption: 'โนบิกับบ่ายวันวาดรูป — ไม่ต้องวาดให้สวยที่สุด แค่ได้ใช้สีที่ชอบ วันนี้ก็มีความสุขเพิ่มขึ้นอีกนิดแล้ว', alt: 'โนบิในเดรสชมพูใช้พู่กันวาดดอกไม้ในสมุดวาดรูปบนโต๊ะไม้ มุมเฉียงด้านหน้าเห็นรองเท้าทั้งสองข้าง', image: '/images/cozy/moments-nobi-1200-v5.webp', thumb: '/images/cozy/moments-nobi-480-v5.webp', tilt: -4 },
  { title: 'A quiet moment', short: 'พักใจไว้กับลมหายใจ', caption: 'บูตะนั่งสมาธิในห้องพระ — วางเรื่องวุ่น ๆ ลงสักครู่ อยู่กับลมหายใจตรงนี้ ไม่ต้องรีบคิดคำตอบให้ทุกเรื่องในวันนี้ก็ได้', alt: 'บูตะใส่สูทม่วงแขนยาวนั่งขัดสมาธิบนเบาะในห้องพระโทนไม้อบอุ่น', image: '/images/cozy/moments-boota-1200-v4.webp', thumb: '/images/cozy/moments-boota-480-v4.webp', tilt: 2 },
  { title: 'One more step', short: 'ทีละสเต็ป ในจังหวะของเรา', caption: 'ชิบะซ้อมเต้นหน้ากระจก — วันนี้ยังไม่เป๊ะก็ไม่เป็นไร ลองอีกครั้ง ขยับอีกนิด ทุกสเต็ปที่ซ้อมคือการค่อย ๆ เก่งขึ้นในแบบของเรา', alt: 'ชิบะใส่แจ็กเก็ตฟ้าซ้อมสเต็ปเต้นในสตูดิโอพื้นไม้พร้อมเงาสะท้อนในกระจก', image: '/images/cozy/moments-shiba-1200-v3.webp', thumb: '/images/cozy/moments-shiba-480-v3.webp', tilt: -2 },
];
const navItems = [['รู้จักแก๊ง', '#friends'], ['ตารางงาน', '/events'], ['อัลบั้ม', '#moments']];

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
  const [modal, setModal] = useState(null);
  const [toast, setToast] = useState('');
  const [albumIndex, setAlbumIndex] = useState(0);
  // เริ่มจากข้อมูลที่ server ดึงมาแล้ว (SSR เห็นงานทันที) แล้วค่อย refresh ฝั่ง client
  const [events, setEvents] = useState(initialEvents);
  const [products, setProducts] = useState(initialProducts);
  const [eventState, setEventState] = useState(initialEvents.length ? 'ready' : 'loading');
  useCozyMotion();
  useReveal([events, products]);
  useEffect(() => {
    api('/events').then(list => { setEvents(list.filter(e => e.status !== 'ended').slice(0, 2)); setEventState('ready'); }).catch(() => setEventState('error'));
    api('/shop/products').then(list => { setProducts(list.filter(p => p.featured).concat(list.filter(p => !p.featured)).slice(0, 4)); cart.sync(list); }).catch(() => {});
  }, []);
  useEffect(() => { if (toast) { const t = setTimeout(() => setToast(''), 2500); return () => clearTimeout(t); } }, [toast]);
  const closeModal = () => setModal(null);
  const addToCart = (p) => { if (p.variants?.length) return navigate(`/shop/${p.slug}`); setToast(cart.add(p, null, 1) ? `เพิ่ม ${p.name} ลงตะกร้าแล้ว` : 'สินค้าหมดแล้ว'); };

  return <div className="hm hm-party-shell">
    <a className="skip-link" href="#main">ข้ามไปเนื้อหา</a>
    <SiteHeader links={navItems} />

    <main id="main">
      {/* ---------- HERO ---------- */}
      <section className="party-hero" aria-labelledby="hero-title">
        <picture className="party-scene">
          <source media="(max-width: 900px) and (orientation: portrait)" srcSet="/images/cozy/housewarming-fresh-mobile.webp" />
          <img src="/images/cozy/housewarming-fresh-desktop.webp" alt="โนบิ บูตะ และชิบะ เต้นฉลองเปิดบ้านไม้โทนอุ่น มีลูกโป่งและไฟประดับ" fetchPriority="high" width="1672" height="941" data-cozy-depth="0.04" />
        </picture>
        <div className="party-light" aria-hidden="true" />
        <div className="party-sparkles" aria-hidden="true">{Array.from({ length: 12 }, (_, i) => <span key={i} style={{ '--x': `${8 + (i * 23) % 85}%`, '--y': `${12 + (i * 17) % 70}%` }} />)}</div>
        <div className="party-copy">
          <span className="party-eyebrow">OUR NEW HOME · YOUR HAPPY PLACE</span>
          <h1 id="hero-title">ยินดีต้อนรับ<span>สู่บ้าน BIGCAT <i>♡</i></span></h1>
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
          <div className="hm-char-img"><img src={characterImage(m.id)} alt={m.alt} loading="lazy" width="1024" height="1536" /></div>
          <div className="hm-char-text"><h3>{m.name}</h3><p>{m.text}</p><span className="hm-char-icon" aria-hidden="true">{m.icon}</span><span className="hm-more">VIEW MORE <b>→</b></span></div>
        </button>)}</div>
      </section>

      {/* ---------- EVENTS ---------- */}
      <section id="events" className="hm-section">
        <SectionHead label="UPCOMING EVENTS" note="ดูตารางงานทั้งหมด →" to="/events" />
        <div className="hm-events">
          <div className="hm-events-copy reveal"><h2>Where to<br />next? <i>♡</i></h2><p>นัดหน้าของพวกเรา —<br />ดูวัน เวลา และที่ที่จะได้เจอกัน</p></div>
          {events.length === 0 && <div className="hm-event-empty" role="status"><Flower /><p>{eventState === 'loading' ? 'กำลังดูว่านัดหน้าเราเจอกันที่ไหน…' : eventState === 'error' ? 'ยังโหลดตารางงานไม่ได้ในขณะนี้' : 'ยังไม่มีนัดใหม่ — ติดตามที่ TikTok ก่อนนะคะ'}</p>{eventState === 'ready' ? <a href={SOCIALS.nobi[0][2]} target="_blank" rel="noopener">TikTok น้องโนบิ →</a> : <Link to="/events">{eventState === 'error' ? 'ลองดูตารางงานอีกครั้ง' : 'ไปหน้าตารางงาน'} →</Link>}</div>}
          {events.map((ev, i) => { const d = eventDate(ev); return <Link key={ev.slug} to={`/events/${ev.slug}`} className="hm-event reveal" style={{ '--delay': `${i * 120}ms` }}>
            <div className="hm-event-img"><img src={ev.cover || HERO} alt={`ภาพปกงาน ${ev.title}`} loading="lazy" /><span className="hm-date"><strong>{Number(d.day)}</strong>{TH_MONTHS[d.start.getMonth()]}</span></div>
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
          <div className="hm-merch-art hm-merch-art--studio"><img src={MERCH_DISPLAY} srcSet="/images/bigcat-merch-pink-v4-small.webp 840w, /images/bigcat-merch-pink-v4.webp 1672w" sizes="(max-width: 760px) 100vw, 67vw" width="1672" height="941" alt="ของสะสม BIGCAT: หมวกแก๊ป 4 สี ตุ๊กตาโนบิ บูตะ ชิบะ ยางรัดผม และเสื้อยืดดำ Call Me My Boo" loading="lazy" decoding="async" /></div>
          <Flower className="hm-flower hm-flower-3" />
        </div>
        {products.length > 0 && <div className="hm-products">{products.map((p, i) => <article key={p.id} className="hm-product reveal" style={{ '--delay': `${i * 90}ms` }}>
          <Link to={`/shop/${p.slug}`} className="hm-product-img"><img src={p.image || MERCH} alt={`${p.name_th || p.name} — ของแก๊ง BIGCAT`} loading="lazy" />{!p.available && <span className="hm-tag">หมดแล้ว</span>}</Link>
          <div className="hm-product-info"><div><h3>{p.name}</h3><p>{p.name_th}</p></div><div className="hm-product-buy"><span>฿{p.price.toLocaleString()}</span><button className="icon-button product-add" disabled={!p.available} onClick={() => addToCart(p)} aria-label={`เพิ่ม ${p.name} ลงตะกร้า`}><Icon name={p.variants?.length ? 'arrow' : 'plus'} size={18} /></button></div></div>
        </article>)}</div>}
      </section>

      {/* ---------- ALBUM ---------- */}
      <section id="moments" className="hm-section">
        <SectionHead label="PHOTO ALBUM" note="OUR MOMENTS ♡" />
        <div className="hm-album">
          <div className="hm-album-copy reveal"><h2>Our<br />Moments <i>♡</i></h2><p>วาดรูป พักใจ ขยับไปตามจังหวะ<br />ความสุขเล็ก ๆ ในวันว่างของพวกเรา</p></div>
          <div className="hm-polaroids">{photos.map((ph, i) => <button key={ph.title} className="hm-polaroid reveal" style={{ '--tilt': `${ph.tilt}deg`, '--delay': `${i * 120}ms` }} onClick={() => { setAlbumIndex(i); setModal({ type: 'album' }); }}><img src={ph.thumb} alt={ph.alt} width="480" height="480" loading="lazy" /><span>{ph.title}</span><small className="hm-moment-caption">{ph.short}</small></button>)}</div>
          <div className="hm-sticky reveal"><span>Thank you<br />for staying.</span><small>ขอบคุณที่อยู่ด้วยกันเสมอ</small><Flower className="hm-sticky-flower" /></div>
        </div>
      </section>
    </main>

    <SiteFooter links={[...navItems, ['SHOP', '/shop'], ['ความเป็นส่วนตัว', '/privacy']]} />

    {toast && <div className="toast" role="status"><Icon name="check" />{toast} <Link to="/cart" className="toast-link">ดูตะกร้า →</Link></div>}
    {modal?.type === 'member' && (() => { const m = modal.member, r = m.resume; return <Modal title={`${m.name} / ${m.thai}`} wide onClose={closeModal}>
      <div className={`resume tone-${m.tone}`}>
        <aside className="resume-side">
          <div className={`hm-modal-portrait tone-${m.tone}`}><img src={characterImage(m.id)} alt={m.alt} /></div>
          <span className="eyebrow">{m.tag}</span>
          <dl className="resume-facts">{r.facts.map(([k, v]) => <div key={k}><dt>{k}</dt><dd><Tagged text={v} /></dd></div>)}</dl>
          {m.socials && <div className="member-social"><span className="hm-label">FOLLOW {m.name}</span><SocialRow items={SOCIALS[m.socials]} /></div>}
        </aside>
        <div className="resume-main">
          <h3 className="resume-headline">{r.headline}</h3>
          <section><span className="hm-label">ABOUT</span><p>{r.about}</p></section>
          <section><span className="hm-label">SKILLS</span><ul className="resume-skills">{r.skills.map(x => <li key={x}>{x}</li>)}</ul></section>
          <section><span className="hm-label">TODAY</span><p><Tagged text={m.detail} /></p></section>
          <blockquote className="resume-quote">“{r.quote}”<cite>— {m.thai}</cite></blockquote>
        </div>
      </div>
    </Modal>; })()}
    {modal?.type === 'album' && <Modal title={photos[albumIndex].title} wide onClose={closeModal}><img className="album-full" src={photos[albumIndex].image} alt={photos[albumIndex].caption} /><div className="album-controls"><button className="icon-button" aria-label="ภาพก่อนหน้า" onClick={() => setAlbumIndex((albumIndex + photos.length - 1) % photos.length)}>←</button><p>{photos[albumIndex].caption}<small>{albumIndex + 1} / {photos.length}</small></p><button className="icon-button" aria-label="ภาพถัดไป" onClick={() => setAlbumIndex((albumIndex + 1) % photos.length)}>→</button></div></Modal>}
  </div>;
}
