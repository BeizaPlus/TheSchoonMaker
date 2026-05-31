import { useEffect, useId, useMemo, useState } from 'react';
import { FiChevronDown, FiChevronUp } from 'react-icons/fi';
import { subscribeMonitorState, unlockAmbience } from '../lib/audio.js';
import { STORAGE } from '../lib/storageKeys.js';
import AudioVolumeControl from './AudioVolumeControl.jsx';

function jitter(value, spread, decimals = 0) {
  const delta = (Math.random() - 0.5) * spread * 2;
  const next = value + delta;
  if (decimals === 0) return Math.round(next);
  return Number(next.toFixed(decimals));
}

function readMonitorCollapsed() {
  try {
    return localStorage.getItem(STORAGE.monitorCollapsed) === '1';
  } catch {
    return false;
  }
}

function EcgWave({ hr = 88, alarm = false }) {
  const gradId = useId().replace(/:/g, '');
  const beatMs = Math.max(420, Math.min(1200, 60000 / Math.max(hr, 40)));
  return (
    <svg className={`icu-ecg ${alarm ? 'alarm' : ''}`} viewBox="0 0 240 48" aria-hidden>
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="rgba(74, 222, 128, 0.15)" />
          <stop offset="35%" stopColor="#4ade80" />
          <stop offset="100%" stopColor="rgba(74, 222, 128, 0.2)" />
        </linearGradient>
      </defs>
      <path
        className="icu-ecg-grid"
        d="M0 24 H240 M0 12 H240 M0 36 H240"
        stroke="rgba(255,255,255,0.06)"
        strokeWidth="1"
      />
      <path
        className="icu-ecg-line"
        d="M0 24 L24 24 L30 18 L36 30 L42 24 L54 24 L60 10 L66 38 L72 24 L240 24"
        fill="none"
        stroke={`url(#${gradId})`}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ animationDuration: `${beatMs}ms` }}
      />
    </svg>
  );
}

function VitalCell({ label, value, tone = 'ok' }) {
  return (
    <div className={`icu-detail-cell ${tone}`}>
      <span className="icu-detail-k">{label}</span>
      <span className="icu-detail-v">{value}</span>
    </div>
  );
}

export default function IcuMonitorStrip({
  vitals,
  className = '',
  showVolume = true,
  collapsible = true,
  ordersDone = null,
  ordersTotal = null,
  careUnit = '',
  flowTrack = '',
}) {
  const [state, setState] = useState({ blocked: false, playing: false });
  const [collapsed, setCollapsed] = useState(() => readMonitorCollapsed());
  const [detailOpen, setDetailOpen] = useState(false);
  const [live, setLive] = useState(() => ({
    hr: vitals?.hr ?? 88,
    spo2: vitals?.spo2 ?? 97,
    sbp: vitals?.sbp ?? 118,
    dbp: vitals?.dbp ?? 72,
    rr: vitals?.rr ?? 18,
    temp: vitals?.temp ?? 37,
    lactate: vitals?.lactate ?? 1.4,
  }));

  useEffect(() => subscribeMonitorState(setState), []);

  useEffect(() => {
    setLive({
      hr: vitals?.hr ?? 88,
      spo2: vitals?.spo2 ?? 97,
      sbp: vitals?.sbp ?? 118,
      dbp: vitals?.dbp ?? 72,
      rr: vitals?.rr ?? 18,
      temp: vitals?.temp ?? 37,
      lactate: vitals?.lactate ?? 1.4,
    });
  }, [vitals]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setLive((prev) => ({
        hr: jitter(vitals?.hr ?? prev.hr, 2),
        spo2: jitter(vitals?.spo2 ?? prev.spo2, 1),
        sbp: jitter(vitals?.sbp ?? prev.sbp, 3),
        dbp: jitter(vitals?.dbp ?? prev.dbp, 2),
        rr: jitter(vitals?.rr ?? prev.rr, 1),
        temp: jitter(vitals?.temp ?? prev.temp, 0.15, 1),
        lactate: jitter(vitals?.lactate ?? prev.lactate, 0.12, 1),
      }));
    }, 1800);
    return () => window.clearInterval(id);
  }, [vitals]);

  const alarm = useMemo(
    () =>
      (vitals?.spo2 ?? 100) < 92 ||
      (vitals?.sbp ?? 120) < 95 ||
      (vitals?.hr ?? 80) > 120,
    [vitals],
  );

  const toggleCollapsed = (event) => {
    event?.stopPropagation?.();
    event?.preventDefault?.();
    setCollapsed((prev) => {
      const next = !prev;
      if (next) setDetailOpen(false);
      try {
        localStorage.setItem(STORAGE.monitorCollapsed, next ? '1' : '0');
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const handleClick = (event) => {
    if (event?.target?.closest?.('.icu-monitor-collapse-btn, .icu-monitor-audio, .icu-monitor-detail')) {
      return;
    }
    if (state.blocked) {
      unlockAmbience();
      return;
    }
    if (collapsed) {
      setCollapsed(false);
      setDetailOpen(true);
      try {
        localStorage.setItem(STORAGE.monitorCollapsed, '0');
      } catch {
        /* ignore */
      }
      return;
    }
    setDetailOpen((open) => !open);
  };

  const showOrders =
    typeof ordersDone === 'number' &&
    typeof ordersTotal === 'number' &&
    ordersTotal > 0;

  return (
    <div
      className={`icu-monitor-strip ${alarm ? 'alarm' : ''} ${state.blocked ? 'blocked' : ''} ${state.playing ? 'live' : ''} ${collapsed ? 'collapsed' : ''} ${detailOpen ? 'detail-open' : ''} ${className}`.trim()}
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      title={
        state.blocked
          ? 'Click to enable ICU monitor audio'
          : collapsed
            ? 'Expand monitor'
            : detailOpen
              ? 'Collapse vitals detail'
              : 'Expand all vitals'
      }
      aria-label="ICU bedside monitor"
      aria-expanded={!collapsed && detailOpen}
    >
      <div className="icu-monitor-head">
        <span className="icu-monitor-label">
          <span className={`icu-monitor-dot ${state.playing ? 'pulse' : ''}`} aria-hidden />
          Monitor
          {collapsed && (
            <span className="icu-monitor-mini-stat" aria-hidden>
              HR {live.hr}
            </span>
          )}
        </span>
        {showVolume && !collapsed && (
          <div
            className="icu-monitor-audio"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <AudioVolumeControl label="ICU monitor" />
          </div>
        )}
        {collapsible && (
          <button
            type="button"
            className="icu-monitor-collapse-btn"
            onClick={toggleCollapsed}
            onPointerDown={(e) => e.stopPropagation()}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand monitor' : 'Minimize monitor'}
            title={collapsed ? 'Expand monitor' : 'Minimize monitor'}
          >
            {collapsed ? <FiChevronDown aria-hidden /> : <FiChevronUp aria-hidden />}
          </button>
        )}
        {state.blocked && !showVolume && !collapsed && (
          <span className="icu-monitor-hint">Tap for audio</span>
        )}
        {!state.blocked && !collapsed && (
          <span className="icu-monitor-hint">{detailOpen ? 'Less' : 'All vitals'}</span>
        )}
      </div>
      {!collapsed && (
        <>
          <EcgWave hr={live.hr} alarm={alarm} />
          <div className="icu-monitor-readouts">
            <div className={`icu-readout ${alarm && (vitals?.hr ?? 0) > 110 ? 'warn' : 'ok'}`}>
              <span className="icu-readout-k">HR</span>
              <span className="icu-readout-v">{live.hr}</span>
            </div>
            <div className={`icu-readout ${alarm && (vitals?.spo2 ?? 100) < 92 ? 'crit' : 'ok'}`}>
              <span className="icu-readout-k">SpO₂</span>
              <span className="icu-readout-v">{live.spo2}%</span>
            </div>
            <div className={`icu-readout ${alarm && (vitals?.sbp ?? 120) < 95 ? 'crit' : 'ok'}`}>
              <span className="icu-readout-k">NIBP</span>
              <span className="icu-readout-v">
                {live.sbp}/{live.dbp}
              </span>
            </div>
          </div>
          {detailOpen && (
            <div className="icu-monitor-detail" onClick={(e) => e.stopPropagation()}>
              <div className="icu-monitor-detail-grid">
                <VitalCell label="RR" value={live.rr} tone={live.rr > 22 ? 'warn' : 'ok'} />
                <VitalCell
                  label="Temp"
                  value={`${live.temp.toFixed(1)}°C`}
                  tone={live.temp >= 38 ? 'warn' : 'ok'}
                />
                <VitalCell
                  label="Lactate"
                  value={live.lactate.toFixed(1)}
                  tone={live.lactate >= 2 ? 'crit' : 'ok'}
                />
                <VitalCell label="MAP" value={Math.round((live.sbp + 2 * live.dbp) / 3)} tone="ok" />
              </div>
              {(careUnit || flowTrack) && (
                <p className="icu-monitor-meta">
                  {careUnit && <span>{careUnit}</span>}
                  {flowTrack && <span>{flowTrack}</span>}
                </p>
              )}
              {showOrders && (
                <p className="icu-monitor-orders">
                  Orders placed <strong>{ordersDone}</strong> / <strong>{ordersTotal}</strong>
                </p>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
