/** Detect device capability tier for adaptive rendering. */
export function getDeviceProfile() {
  if (typeof window === 'undefined') {
    return { tier: 'high', compact: false, reducedMotion: false };
  }
  const cores = navigator.hardwareConcurrency || 4;
  const memory = navigator.deviceMemory || 4;
  const compact = window.innerWidth <= 900 || window.innerHeight <= 740;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarse = window.matchMedia('(pointer: coarse)').matches;

  let tier = 'high';
  if (compact || cores <= 6 || memory <= 4 || reducedMotion) tier = 'medium';
  if ((compact && cores <= 4) || memory <= 2 || (reducedMotion && compact)) tier = 'low';

  return { tier, compact, reducedMotion, coarse, cores, memory };
}

export function applyDeviceProfile() {
  if (typeof document === 'undefined') return getDeviceProfile();
  const profile = getDeviceProfile();
  const root = document.documentElement;
  root.dataset.perf = profile.tier;
  root.dataset.viewport = profile.compact ? 'compact' : 'wide';
  if (profile.reducedMotion) root.dataset.motion = 'reduce';
  return profile;
}

export function isLowPerf() {
  return getDeviceProfile().tier === 'low';
}
