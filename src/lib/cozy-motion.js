import { useEffect } from 'react';

// Gentle image depth without React renders on scroll. All listeners are route-local.
export function useCozyMotion() {
  useEffect(() => {
    const media = window.matchMedia('(prefers-reduced-motion: reduce)');
    const layers = [...document.querySelectorAll('[data-cozy-depth]')];
    let frame = 0;
    const update = () => {
      frame = 0;
      layers.forEach(layer => {
        const box = layer.parentElement.getBoundingClientRect();
        const distance = window.innerHeight / 2 - box.top - box.height / 2;
        const y = media.matches ? 0 : Math.max(-12, Math.min(12, distance * Number(layer.dataset.cozyDepth)));
        layer.style.setProperty('--cozy-y', `${y}px`);
      });
    };
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update); };
    update();
    window.addEventListener('scroll', schedule, { passive: true });
    window.addEventListener('resize', schedule);
    media.addEventListener('change', update);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
      media.removeEventListener('change', update);
    };
  }, []);
}
