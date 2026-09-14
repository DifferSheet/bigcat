'use client';
import { useSyncExternalStore } from 'react';

// ตะกร้าเก็บใน localStorage: [{ key, productId, variantId, slug, name, variantName, price, image, qty }]
const KEY = 'bigcat-cart';
const EMPTY = []; // ต้องเป็น reference เดิมทุกครั้ง ไม่งั้น useSyncExternalStore วน render (SSR)
let items = load();
const listeners = new Set();

function load() { if (typeof localStorage === 'undefined') return EMPTY; try { return JSON.parse(localStorage.getItem(KEY) || '[]'); } catch { return EMPTY; } }
function commit(next) {
  items = next;
  try { localStorage.setItem(KEY, JSON.stringify(items)); } catch { /* optional */ }
  listeners.forEach(fn => fn());
}
const keyOf = (productId, variantId) => `${productId}:${variantId || 0}`;

export const cart = {
  get: () => items,
  add(product, variant, qty = 1) {
    const key = keyOf(product.id, variant?.id);
    const max = variant ? variant.stock : product.stock;
    const cur = items.find(i => i.key === key);
    const nextQty = Math.min(max, (cur?.qty || 0) + qty);
    if (nextQty <= 0) return false;
    const line = { key, productId: product.id, variantId: variant?.id || null, slug: product.slug, name: product.name, nameTh: product.name_th, variantName: variant?.name || null, price: variant ? variant.price : product.price, image: product.image, qty: nextQty, max };
    commit(cur ? items.map(i => i.key === key ? line : i) : [...items, line]);
    return true;
  },
  setQty(key, qty) { commit(qty <= 0 ? items.filter(i => i.key !== key) : items.map(i => i.key === key ? { ...i, qty: Math.min(i.max || 99, qty) } : i)); },
  remove(key) { commit(items.filter(i => i.key !== key)); },
  clear() { commit([]); },
  // ปรับตะกร้าให้ตรงกับสต็อก/ราคาล่าสุดจาก server
  sync(products) {
    const next = items.flatMap(i => {
      const p = products.find(x => x.id === i.productId);
      if (!p || !p.available) return [];
      const v = i.variantId ? p.variants.find(x => x.id === i.variantId) : null;
      if (i.variantId && !v) return [];
      const max = v ? v.stock : p.stock;
      if (max <= 0) return [];
      return [{ ...i, price: v ? v.price : p.price, image: p.image, name: p.name, nameTh: p.name_th, max, qty: Math.min(i.qty, max) }];
    });
    if (JSON.stringify(next) !== JSON.stringify(items)) commit(next);
  },
};

const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
export function useCart() {
  const list = useSyncExternalStore(subscribe, () => items, () => EMPTY);
  return { items: list, count: list.reduce((s, i) => s + i.qty, 0), subtotal: list.reduce((s, i) => s + i.price * i.qty, 0) };
}
