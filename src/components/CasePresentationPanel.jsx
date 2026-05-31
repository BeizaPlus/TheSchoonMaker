import { useMemo, useState } from 'react';
import {
  parseClinicalSections,
  shortSectionTitle,
} from '../lib/clinicalTextFormat.js';

export default function CasePresentationPanel({
  intro = '',
  history = '',
  vitals = '',
  textStyle = {},
  className = '',
}) {
  const historySections = useMemo(() => parseClinicalSections(history), [history]);
  const topTabs = useMemo(() => {
    const tabs = [];
    if (intro?.trim()) tabs.push({ id: 'intro', label: 'Intro' });
    if (history?.trim()) tabs.push({ id: 'history', label: 'History' });
    if (vitals?.trim()) tabs.push({ id: 'vitals', label: 'Vitals' });
    if (!tabs.length) tabs.push({ id: 'history', label: 'Presentation' });
    return tabs;
  }, [intro, history, vitals]);

  const [topTab, setTopTab] = useState(() => topTabs[0]?.id || 'history');
  const [historyTab, setHistoryTab] = useState(0);

  const activeHistory =
    historySections[Math.min(historyTab, Math.max(historySections.length - 1, 0))] ||
    historySections[0];

  const showHistorySubTabs = topTab === 'history' && historySections.length > 1;

  return (
    <div className={`case-presentation-panel ${className}`.trim()}>
      <div className="case-info-tabs" role="tablist" aria-label="Presentation sections">
        {topTabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={topTab === tab.id ? 'case-info-tab active' : 'case-info-tab'}
            onClick={() => setTopTab(tab.id)}
            aria-selected={topTab === tab.id}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {showHistorySubTabs && (
        <div className="case-info-tabs case-presentation-subtabs" role="tablist" aria-label="History subsections">
          {historySections.map((section, idx) => (
            <button
              key={`${section.title}-${idx}`}
              type="button"
              className={historyTab === idx ? 'case-info-tab active' : 'case-info-tab'}
              onClick={() => setHistoryTab(idx)}
              aria-selected={historyTab === idx}
            >
              {shortSectionTitle(section.title)}
            </button>
          ))}
        </div>
      )}

      <section className="soap-section case-presentation-body" style={textStyle}>
        <h3 className="soap-heading">
          {topTab === 'intro' && 'Case introduction'}
          {topTab === 'history' && (activeHistory?.title || 'History')}
          {topTab === 'vitals' && 'Vitals'}
        </h3>
        <p className="soap-body">
          {topTab === 'intro' && (intro || 'No introduction available.')}
          {topTab === 'history' && (activeHistory?.body || history || 'No history available.')}
          {topTab === 'vitals' && (vitals || 'No vitals documented.')}
        </p>
      </section>
    </div>
  );
}
