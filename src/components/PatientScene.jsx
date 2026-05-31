import { useCallback, useEffect, useRef, useState } from 'react';
import { getPatientScene } from '../data/gameData.js';
import { STORAGE } from '../lib/storageKeys.js';

const idleVideos = [
  '/assets/video/breathing_01.mp4',
  '/assets/video/breathing_02.mp4',
  '/assets/video/breathing_03.mp4',
];

const DEATH_VIDEO = '/assets/video/death.mp4';
const IDLE_CROSSFADE_MS = 800;

function pickIdle(exclude) {
  const pool = exclude ? idleVideos.filter((src) => src !== exclude) : idleVideos;
  if (pool.length === 0) return idleVideos[0];
  return pool[Math.floor(Math.random() * pool.length)];
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function slotSrc(slot) {
  if (!slot) return '';
  const attr = slot.getAttribute('src');
  if (attr) return attr;
  const url = slot.currentSrc || slot.src;
  if (!url) return '';
  try {
    const path = new URL(url, window.location.href).pathname;
    return path.startsWith('/') ? path : `/${path}`;
  } catch {
    return url;
  }
}

const videoLayerStyle = {
  position: 'absolute',
  inset: 0,
  overflow: 'hidden',
};

const videoStyleBase = {
  position: 'absolute',
  left: '50%',
  top: '50%',
  transform: 'translate(-50%, -50%)',
  minWidth: '100%',
  minHeight: '100%',
  width: 'auto',
  height: 'auto',
  maxWidth: 'none',
  objectFit: 'cover',
  pointerEvents: 'none',
  userSelect: 'none',
};

export default function PatientScene({
  scene = null,
  className = 'patient-scene-img',
  imgRef = null,
  onLoad = null,
  forceSrc = null,
  showVideoBackground = true,
}) {
  const cfg = scene || getPatientScene();
  const overrideSrc =
    typeof window !== 'undefined' ? window.localStorage?.getItem(STORAGE.patientImage) : null;
  const src = forceSrc || overrideSrc || cfg?.src;
  const showCustomScene = Boolean(forceSrc);

  const activeRef = useRef(null);
  const nextRef = useRef(null);
  const deathRef = useRef(null);
  const idleSwappingRef = useRef(false);
  const [frontKey, setFrontKey] = useState('active');
  const [crossfading, setCrossfading] = useState(false);

  const frontRef = frontKey === 'active' ? activeRef : nextRef;
  const backRef = frontKey === 'active' ? nextRef : activeRef;

  const loadSlot = useCallback((slot, videoSrc) => {
    if (!slot) return;
    slot.src = videoSrc;
    slot.loop = false;
    slot.muted = true;
    slot.playsInline = true;
    slot.load();
  }, []);

  const crossfadeIdle = useCallback(async () => {
    if (idleSwappingRef.current || !showVideoBackground || showCustomScene) return;
    const frontSlot = frontRef.current;
    const backSlot = backRef.current;
    if (!frontSlot || !backSlot) return;

    idleSwappingRef.current = true;
    try {
      await backSlot.play().catch(() => {});
      setCrossfading(true);
      await sleep(IDLE_CROSSFADE_MS);

      frontSlot.pause();
      frontSlot.currentTime = 0;
      setCrossfading(false);
      setFrontKey((key) => (key === 'active' ? 'next' : 'active'));

      const nextFront = frontKey === 'active' ? nextRef.current : activeRef.current;
      const nextBack = frontKey === 'active' ? activeRef.current : nextRef.current;
      loadSlot(nextBack, pickIdle(slotSrc(nextFront)));
    } finally {
      idleSwappingRef.current = false;
    }
  }, [backRef, frontKey, frontRef, loadSlot, showCustomScene, showVideoBackground]);

  const onIdleEnded = useCallback(() => {
    crossfadeIdle();
  }, [crossfadeIdle]);

  useEffect(() => {
    if (!showVideoBackground || showCustomScene) return undefined;

    idleSwappingRef.current = false;
    setFrontKey('active');
    const activeSlot = activeRef.current;
    const nextSlot = nextRef.current;
    if (!activeSlot || !nextSlot) return undefined;

    const start = pickIdle(null);
    loadSlot(activeSlot, start);
    loadSlot(nextSlot, pickIdle(start));

    activeSlot.addEventListener('ended', onIdleEnded);
    activeSlot.play().catch(() => {});

    return () => {
      activeSlot.removeEventListener('ended', onIdleEnded);
      activeSlot.pause();
      nextSlot.pause();
    };
  }, [loadSlot, onIdleEnded, showCustomScene, showVideoBackground]);

  useEffect(() => {
    const frontSlot = frontRef.current;
    if (!frontSlot || !showVideoBackground || showCustomScene) return undefined;

    const handler = () => onIdleEnded();
    frontSlot.addEventListener('ended', handler);
    return () => frontSlot.removeEventListener('ended', handler);
  }, [frontKey, frontRef, onIdleEnded, showCustomScene, showVideoBackground]);

  if (!src) return null;

  const slotOpacity = (key) => {
    const isFront = key === frontKey;
    if (crossfading) return isFront ? 0 : 1;
    return isFront ? 1 : 0;
  };

  const slotZIndex = (key) => {
    const isFront = key === frontKey;
    if (crossfading) return isFront ? 0 : 1;
    return isFront ? 1 : 0;
  };

  return (
    <>
      {showVideoBackground && !showCustomScene && (
        <div className="video-layer" style={videoLayerStyle}>
          <video
            ref={activeRef}
            className="idle-slot is-front patient-scene-img"
            muted
            playsInline
            preload="auto"
            style={{
              ...videoStyleBase,
              objectPosition: cfg.objectPosition || 'center center',
              transition: crossfading ? `opacity ${IDLE_CROSSFADE_MS}ms ease` : 'none',
              opacity: slotOpacity('active'),
              zIndex: slotZIndex('active'),
            }}
          />
          <video
            ref={nextRef}
            className="idle-slot is-back patient-scene-img"
            muted
            playsInline
            preload="auto"
            style={{
              ...videoStyleBase,
              objectPosition: cfg.objectPosition || 'center center',
              transition: crossfading ? `opacity ${IDLE_CROSSFADE_MS}ms ease` : 'none',
              opacity: slotOpacity('next'),
              zIndex: slotZIndex('next'),
            }}
          />
          <video
            ref={deathRef}
            id="death"
            className="patient-scene-img"
            src={DEATH_VIDEO}
            muted
            playsInline
            preload="auto"
            style={{
              ...videoStyleBase,
              objectPosition: cfg.objectPosition || 'center center',
              opacity: 0,
              zIndex: 0,
            }}
          />
        </div>
      )}
      <img
        ref={imgRef}
        className={className}
        src={src}
        alt="Patient in hospital bed"
        draggable={false}
        onLoad={onLoad}
        style={{
          objectFit: cfg.objectFit || 'cover',
          objectPosition: cfg.objectPosition || 'center',
          opacity: showCustomScene || !showVideoBackground ? 1 : 0,
          pointerEvents: 'none',
        }}
      />
    </>
  );
}
