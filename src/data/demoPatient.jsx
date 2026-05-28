export function DemoPatient() {
  return (
    <svg viewBox="0 0 800 500" className="patient-svg" aria-label="Patient in bed">
      <rect fill="#15151c" width="800" height="500" />
      <rect x="60" y="100" width="680" height="300" rx="12" fill="#22222e" />
      <ellipse cx="400" cy="195" rx="72" ry="58" fill="#c9a87c" />
      <rect x="310" y="248" width="180" height="110" rx="24" fill="#2d4a6f" />
      <rect x="600" y="70" width="110" height="150" rx="8" fill="#0d1117" stroke="#3b82f6" strokeWidth="3" />
      <rect x="90" y="210" width="90" height="130" rx="6" fill="#0f2920" stroke="#22c55e" strokeWidth="2" />
      <text x="400" y="470" textAnchor="middle" fill="#555" fontSize="13" fontFamily="system-ui">
        Demo patient
      </text>
    </svg>
  );
}
