// GE ONE adaptive device presentation. Layout only: never changes reports, forms or PDF markup.
const root = document.documentElement;
const fine = window.matchMedia('(hover: hover) and (pointer: fine)');
const coarse = window.matchMedia('(pointer: coarse)');
const mobile = window.matchMedia('(max-width: 700px)');
const wide = window.matchMedia('(min-width: 1100px)');

function isTabletPlatform() {
  const ua = navigator.userAgent || '';
  const ipad = /iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1);
  const androidTablet = /Android/i.test(ua) && !/Mobile/i.test(ua);
  return ipad || androidTablet;
}

export function getDevicePresentation() {
  // Hardware input is used in addition to screen size so large iPads don't
  // accidentally get the laptop layout. Windows touch laptops retain desktop.
  if (isTabletPlatform()) return 'tablet';
  // A narrow laptop window must not be mistaken for a phone.
  if (mobile.matches && (coarse.matches || !fine.matches)) return 'mobile';
  if (wide.matches && (fine.matches || !coarse.matches)) return 'desktop';
  return 'tablet';
}

let pending = false;
function applyPresentation() {
  pending = false;
  const device = getDevicePresentation();
  if (root.dataset.geDevice !== device) root.dataset.geDevice = device;
}
function schedulePresentation() {
  if (pending) return;
  pending = true;
  window.requestAnimationFrame(applyPresentation);
}
applyPresentation();
for (const query of [fine, coarse, mobile, wide]) {
  if (query.addEventListener) query.addEventListener('change', schedulePresentation);
  else query.addListener?.(schedulePresentation);
}
window.addEventListener('resize', schedulePresentation, { passive: true });
window.addEventListener('orientationchange', schedulePresentation, { passive: true });
