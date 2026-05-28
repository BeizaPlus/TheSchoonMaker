/** localStorage keys — prefixed for Schoonmaker. */
export const STORAGE = {
  progress: 'schoonmaker_progress',
  theme: 'schoonmaker_theme',
  patientImage: 'schoonmaker_patient_image',
  patientMime: 'schoonmaker_patient_mime',
  visionZones: 'schoonmaker_vision_zones',
  studioZones: 'schoonmaker_studio_zones',
  dropMode: 'schoonmaker_drop_mode',
  showCues: 'schoonmaker_show_cues',
  sceneVariants: 'schoonmaker_scene_variant_urls',
  captureAttempt: 'schoonmaker_capture_attempt',
  welcomePlate: 'schoonmaker_welcome_plate',
  welcomeGridItems: 'schoonmaker_welcome_grid',
  playGridItems: 'schoonmaker_play_grid',
  briefingPickerPos: 'schoonmaker_briefing_picker_pos',
  audienceProfile: 'schoonmaker_audience_profile',
  soapDraft: 'schoonmaker_soap_draft',
};

const LEGACY = {
  dotphrase_progress: STORAGE.progress,
  dotphrase_theme: STORAGE.theme,
  dotphrase_patient_image: STORAGE.patientImage,
  dotphrase_patient_mime: STORAGE.patientMime,
  dotphrase_vision_zones: STORAGE.visionZones,
  dotphrase_studio_zones: STORAGE.studioZones,
  dotphrase_drop_mode: STORAGE.dropMode,
  dotphrase_show_cues: STORAGE.showCues,
  dotphrase_scene_variant_urls: STORAGE.sceneVariants,
  dotphrase_welcome_plate: STORAGE.welcomePlate,
};

/** One-time copy from DotPhrase keys so existing saves keep working. */
export function migrateLegacyStorage() {
  if (typeof window === 'undefined') return;
  try {
    for (const [oldKey, newKey] of Object.entries(LEGACY)) {
      const val = localStorage.getItem(oldKey);
      if (val != null && localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, val);
      }
    }
    const legacyPrefix = 'dotphrase_capture_attempt_';
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (!key?.startsWith(legacyPrefix)) continue;
      const suffix = key.slice(legacyPrefix.length);
      const newKey = `${STORAGE.captureAttempt}_${suffix}`;
      if (localStorage.getItem(newKey) == null) {
        localStorage.setItem(newKey, localStorage.getItem(key));
      }
    }
  } catch {
    /* ignore */
  }
}
