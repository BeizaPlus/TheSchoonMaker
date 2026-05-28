/** True when opened as the studio / authoring build (not the player app). */
export function isStudioApp() {
  if (typeof window !== 'undefined') {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('studio') === '1' || params.get('studio') === 'true') return true;
      if (window.location.hash === '#studio') return true;
      if (window.__SCHOONMAKER_STUDIO__ === true || window.__DOTPHRASE_STUDIO__ === true) return true;
    } catch {
      /* ignore */
    }
  }
  return import.meta.env.VITE_STUDIO === '1';
}

export function playerAppHref() {
  if (typeof window === 'undefined') return '/';
  const url = new URL(window.location.href);
  url.searchParams.delete('studio');
  if (url.hash === '#studio') url.hash = '';
  return `${url.pathname}${url.search}${url.hash}`;
}

export function studioAppHref() {
  if (typeof window === 'undefined') return '/?studio=1';
  const url = new URL(window.location.href);
  url.searchParams.set('studio', '1');
  return `${url.pathname}${url.search}`;
}
