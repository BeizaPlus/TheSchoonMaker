import gameConfig from './gameConfig.json' with { type: 'json' };
import { getPreparedCase } from '../lib/caseNarrative.js';
import { inferPatientSex } from '../lib/patientSex.js';
import { resolvePlaybook } from './resolvePlaybook.js';

export function getGameConfig() {
  return gameConfig;
}

export function getBranding() {
  return gameConfig.branding;
}

export function getZones() {
  return gameConfig.zones;
}

export function getZoneColors() {
  return gameConfig.zoneColors;
}

export function getUi() {
  return gameConfig.ui;
}

export function getDragConfig() {
  return gameConfig.drag;
}

export function getLayout() {
  return gameConfig.layout;
}

export function getPatientScene(sex = 'male') {
  if (sex === 'female' && gameConfig.patientSceneFemale) {
    return gameConfig.patientSceneFemale;
  }
  return gameConfig.patientScene;
}

export function getPatientSceneForCase(caseData) {
  const sex = inferPatientSex(caseData);
  return getPatientScene(sex);
}

/** Build ordered clinical steps from playbook (JSON algorithm overrides). */
export function buildAlgorithm(pb, zones) {
  if (pb.algorithm?.steps?.length) {
    return {
      title: pb.algorithm.title || pb.objective,
      steps: pb.algorithm.steps.map((s, i) => {
        const iv = pb.interventions.find((x) => x.id === s.interventionId);
        return {
          order: s.order ?? i + 1,
          label: s.label || iv?.label,
          interventionId: s.interventionId,
          zone: s.zone || iv?.correct_zone,
          zoneLabel: s.zoneLabel || zones[s.zone || iv?.correct_zone]?.label,
          mapNode: s.mapNode,
          why: iv?.why,
          guideline: iv?.guideline,
        };
      }),
    };
  }
  return {
    title: pb.objective,
    steps: pb.interventions.map((iv, i) => ({
      order: i + 1,
      label: iv.label,
      interventionId: iv.id,
      zone: iv.correct_zone,
      zoneLabel: zones[iv.correct_zone]?.label,
      why: iv.why,
      guideline: iv.guideline,
    })),
  };
}

export function resolvePlaybookForCase(ccsCase) {
  return resolvePlaybook(ccsCase);
}

export function toGameCase(ccsCase, catalog) {
  const pb = resolvePlaybook(ccsCase);
  const prepared = getPreparedCase(ccsCase.id);
  const pres = catalog?.presentations?.[ccsCase.title];
  const introText =
    prepared?.narrative?.doctor?.standard?.intro ||
    pres?.intro?.replace(/\s+/g, ' ').trim().slice(0, 500) ||
    '';
  const vitalsText =
    prepared?.vitalsText || pres?.vitals?.replace(/\s+/g, ' ').trim() || '';
  const historyText =
    prepared?.narrative?.doctor?.standard?.hpi ||
    pres?.history?.replace(/\s+/g, ' ').trim() ||
    '';
  const clinicalTip = prepared?.clinical_tip || pb.clinical_tip;
  const objective = prepared?.objective || pb.objective;
  const interventions =
    prepared?.interventions?.length > 0 ? prepared.interventions : pb.interventions;
  const chiefComplaint = introText || `${ccsCase.title} — CCS Case ${ccsCase.caseNumber}`;
  const sexHint = prepared?.patientSex && prepared.patientSex !== 'unknown'
    ? prepared.patientSex
    : inferPatientSex({ chief_complaint: introText, historyText, title: ccsCase.title });

  return {
    id: ccsCase.id,
    ccsNumber: ccsCase.caseNumber,
    title: ccsCase.title.toUpperCase(),
    category: ccsCase.category,
    diagnosis: pb.diagnosis || null,
    playbookKey: pb.playbookKey || ccsCase.title,
    chief_complaint: chiefComplaint,
    vitalsText,
    historyText,
    clinical_tip: clinicalTip,
    objective,
    timeLimit: ccsCase.timeLimit,
    interventions,
    zones: gameConfig.zones,
    zoneColors: gameConfig.zoneColors,
    patientScene: getPatientSceneForCase({
      chief_complaint: introText,
      historyText,
      title: ccsCase.title,
    }),
    patientSex: sexHint,
    preparedMeta: prepared
      ? {
          vitalsSource: prepared.vitalsSource,
          hasSourceIntro: prepared.hasSourceIntro,
          flowTrack: prepared.flowTrack,
        }
      : null,
    completionThreshold: gameConfig.branding?.completionThreshold ?? 99,
    thanksDoctorVideos: gameConfig.cinematics?.thanksDoctorVideos || [],
    thanksDoctorVideo:
      gameConfig.cinematics?.thanksDoctorVideo ||
      gameConfig.cinematics?.thanksDoctorVideos?.[0] ||
      null,
    algorithm: buildAlgorithm(pb, gameConfig.zones),
    layout: gameConfig.layout,
  };
}
