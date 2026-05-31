import playbooks from './playbooks.json' with { type: 'json' };
import caseSpecific from './caseSpecificPlaybooks.json' with { type: 'json' };

/** Resolve drag-game playbook: per-case authored → title presentation → default. */
export function resolvePlaybook(ccsCase) {
  const specific =
    caseSpecific.cases?.[ccsCase.id] || caseSpecific.cases?.[ccsCase.caseNumber];
  if (specific?.interventions?.length) {
    return { ...specific, playbookKey: `case-${ccsCase.id}` };
  }

  const override =
    playbooks.casePlaybooks?.[ccsCase.id] || playbooks.casePlaybooks?.[ccsCase.caseNumber];
  const key =
    override && typeof override === 'string' && !String(override).startsWith('_')
      ? override
      : ccsCase.title;

  const presentation =
    playbooks.presentations[key] ||
    playbooks.presentations[ccsCase.title] ||
    playbooks.default;

  return { ...presentation, playbookKey: key };
}

export function getCaseSpecificPlaybookIds() {
  return Object.keys(caseSpecific.cases || {});
}

export function hasCaseSpecificPlaybook(caseId) {
  return Boolean(caseSpecific.cases?.[String(caseId)]);
}
