import { getPatientScene } from '../data/gameData.js';
import { STORAGE } from '../lib/storageKeys.js';

export default function PatientScene({
  scene = null,
  className = 'patient-scene-img',
  imgRef = null,
  onLoad = null,
  forceSrc = null,
}) {
  const cfg = scene || getPatientScene();
  const overrideSrc =
    typeof window !== 'undefined' ? window.localStorage?.getItem(STORAGE.patientImage) : null;
  const src = forceSrc || overrideSrc || cfg?.src;
  if (!src) return null;

  return (
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
      }}
    />
  );
}
