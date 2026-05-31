/** Warm the browser cache so the final frame can hold without stutter. */
export function preloadTeachingVideo(src) {
  if (!src) return Promise.resolve(false);
  return new Promise((resolve) => {
    const video = document.createElement('video');
    video.preload = 'auto';
    video.muted = true;
    video.playsInline = true;
    const done = (ok) => {
      video.src = '';
      video.load();
      video.remove();
      resolve(ok);
    };
    video.addEventListener('canplaythrough', () => done(true), { once: true });
    video.addEventListener('error', () => done(false), { once: true });
    video.src = src;
    video.load();
  });
}

/** Pick a reachable teaching-video URL for this case build. */
export async function pickTeachingVideo(caseData) {
  const videoPool = Array.isArray(caseData?.thanksDoctorVideos)
    ? caseData.thanksDoctorVideos.filter(Boolean)
    : [];
  const fallback = caseData?.thanksDoctorVideo || null;
  const candidates = videoPool.length ? videoPool : fallback ? [fallback] : [];

  if (!candidates.length) {
    return { src: null, error: 'No teaching video configured for this case.' };
  }

  const shuffled = [...candidates].sort(() => Math.random() - 0.5);
  for (const candidate of shuffled) {
    try {
      const resp = await fetch(candidate, { method: 'GET', cache: 'no-store' });
      if (resp.ok) return { src: candidate, error: null };
    } catch {
      /* try next */
    }
  }

  return {
    src: null,
    error: 'Teaching video file missing. Add MP4 files to public/assets/video.',
  };
}
