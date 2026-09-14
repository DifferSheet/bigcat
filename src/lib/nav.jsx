'use client';
// shim ให้ component ที่เขียนด้วย react-router ใช้งานกับ Next App Router ได้
import NextLink from 'next/link';
import { useParams as useNextParams, usePathname, useRouter, useSearchParams } from 'next/navigation';
import React from 'react';

export function Link({ to, href, replace, state, target, ...rest }) {
  const url = to ?? href ?? '#';
  // ลิงก์ภายนอก/anchor ใช้ <a> ปกติ
  if (/^(https?:|mailto:|tel:|#|data:)/.test(String(url))) return <a href={url} target={target} {...rest} />;
  return <NextLink href={url} replace={replace} target={target} {...rest} />;
}

export function useNavigate() {
  const router = useRouter();
  return React.useCallback((to, opts = {}) => {
    if (typeof to === 'number') { if (to < 0) router.back(); else router.forward(); return; }
    // state ของ react-router ไม่มีใน Next — ส่งผ่าน sessionStorage แทน (ใช้ครั้งเดียว)
    if (opts.state) { try { sessionStorage.setItem(`nav-state:${to}`, JSON.stringify(opts.state)); } catch { /* optional */ } }
    opts.replace ? router.replace(to) : router.push(to);
  }, [router]);
}

// อ่าน state ที่ส่งมาจาก useNavigate (เทียบเท่า useLocation().state)
export function useLocation() {
  const pathname = usePathname();
  const search = useSearchParams();
  const [state, setState] = React.useState(null);
  React.useEffect(() => {
    try {
      const raw = sessionStorage.getItem(`nav-state:${pathname}`);
      if (raw) { setState(JSON.parse(raw)); sessionStorage.removeItem(`nav-state:${pathname}`); }
    } catch { /* optional */ }
  }, [pathname]);
  return { pathname, search: search?.toString() ? `?${search}` : '', state };
}

export const useParams = useNextParams;
