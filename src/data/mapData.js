import erMap from './erMap.json' with { type: 'json' };

const DISPO_IDS = erMap.dispositionNodeIds || ['icu', 'ward', 'obs', 'transfer'];

export function getErMap() {
  return erMap;
}

export function isDispositionNode(nodeId) {
  return DISPO_IDS.includes(nodeId);
}

/** Pick ICU vs ward vs obs vs transfer from intervention wording. */
export function inferDispositionNode(meta = {}) {
  const text = [meta.label, meta.interventionId, meta.why, meta.mapNode]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (/\b(transfer|helicopter|retrieval|tertiary|outside hospital)\b/.test(text)) {
    return 'transfer';
  }
  if (/\b(observation|obs unit|short-stay|rule.?out)\b/.test(text)) {
    return 'obs';
  }
  if (/\b(ward|floor|telemetry|inpatient|admit to bed|discharge home)\b/.test(text)) {
    return 'ward';
  }
  if (
    /\b(icu|intensive|critical care|shock|isolation|neuro icu|cath lab|or\b|surgery)\b/.test(text)
  ) {
    return 'icu';
  }
  return erMap.defaultDisposition || 'icu';
}

export function zoneToMapNode(zoneKey, stepMeta = {}) {
  if (zoneKey === 'zone-icu') {
    if (stepMeta.mapNode === 'disposition') return inferDispositionNode(stepMeta);
    if (stepMeta.mapNode && erMap.nodes[stepMeta.mapNode]) return stepMeta.mapNode;
    return inferDispositionNode(stepMeta);
  }
  for (const [id, node] of Object.entries(erMap.nodes)) {
    if (node.zoneKey === zoneKey && !node.isDisposition) return id;
  }
  return erMap.playNode || 'resus';
}

export function enrichAlgorithmSteps(algorithm) {
  if (!algorithm?.steps) return [];
  return algorithm.steps.map((s) => {
    let mapNodeId = s.mapNode || zoneToMapNode(s.zone, s);
    if (!erMap.nodes[mapNodeId]) mapNodeId = inferDispositionNode(s);
    return {
      ...s,
      mapNodeId,
      mapNode: erMap.nodes[mapNodeId],
    };
  });
}

export function getTargetDispositionId(algorithm) {
  const steps = enrichAlgorithmSteps(algorithm);
  for (let i = steps.length - 1; i >= 0; i--) {
    if (steps[i].zone === 'zone-icu' || isDispositionNode(steps[i].mapNodeId)) {
      return steps[i].mapNodeId;
    }
  }
  return erMap.defaultDisposition || 'icu';
}

export function getMapPathNodeIds(algorithm) {
  const steps = enrichAlgorithmSteps(algorithm);
  const ids = [erMap.patientStart];
  for (const s of steps) {
    if (s.mapNodeId && ids[ids.length - 1] !== s.mapNodeId) ids.push(s.mapNodeId);
  }
  if (!ids.includes(erMap.playNode)) ids.push(erMap.playNode);
  return ids;
}
