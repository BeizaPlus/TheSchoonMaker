/** Demo patient scene — tuned for the built-in SVG */
export const DEMO_ZONES = {
  'zone-monitor': { cx: 0.78, cy: 0.22, w: 0.14, h: 0.12, label: 'Monitor & imaging' },
  'zone-iv-bag': { cx: 0.18, cy: 0.42, w: 0.12, h: 0.14, label: 'IV fluids' },
  'zone-blood': { cx: 0.38, cy: 0.48, w: 0.12, h: 0.1, label: 'Blood draw' },
  'zone-arm': { cx: 0.5, cy: 0.52, w: 0.14, h: 0.1, label: 'IV / medications' },
  'zone-icu': { cx: 0.5, cy: 0.82, w: 0.22, h: 0.1, label: 'Disposition' },
};

export const ZONE_COLORS = {
  'zone-monitor': '#60a5fa',
  'zone-iv-bag': '#34d399',
  'zone-blood': '#f87171',
  'zone-arm': '#a78bfa',
  'zone-icu': '#fbbf24',
};
