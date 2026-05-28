import { zoneIdForCell, normalizePlacement } from '../lib/placementGrid.js';

/** Fixed-size zone legend (always same footprint — AoE-style slots). */
export default function ZoneRail({ zones, zoneColors, placed, highlight }) {
  const entries = Object.entries(zones);
  const isFilled = (zoneId) =>
    Object.values(placed).some((p) => {
      const norm = normalizePlacement(p);
      if (!norm) return false;
      if (norm.zoneId) return norm.zoneId === zoneId;
      return zoneIdForCell(norm, zones) === zoneId;
    });

  return (
    <div className={`zone-rail ${highlight ? 'zone-rail-lit' : ''}`}>
      {entries.map(([id, z]) => {
        const filled = isFilled(id);
        return (
          <div
            key={id}
            className={`zone-rail-slot ${filled ? 'filled' : ''}`}
            style={{ ['--zc']: zoneColors[id] }}
            title={z.label}
          >
            <span className="zone-rail-dot" />
            <span className="zone-rail-text">{z.label}</span>
          </div>
        );
      })}
    </div>
  );
}
