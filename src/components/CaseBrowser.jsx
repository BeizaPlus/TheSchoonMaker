import { useState, useMemo, useCallback, useEffect } from 'react';
import { getCatalog, getCategories, getCasesInCategory, getCaseById } from '../data/useCcsCatalog.js';
import { getLayout } from '../data/gameData.js';
import {
  readProgress,
  getCaseRecord,
  pickRandomId,
  startShuffleQueue,
  setLastMode,
} from '../data/caseProgress.js';

export default function CaseBrowser({ onPlay, onBack }) {
  const catalog = getCatalog();
  const categories = getCategories();
  const layout = getLayout();
  const [activeCategory, setActiveCategory] = useState(categories[0]?.id);
  const [selectedId, setSelectedId] = useState(() => categories[0]?.caseIds?.[0] || '001');
  const progress = useMemo(() => readProgress(), []);

  const casesInView = useMemo(
    () => getCasesInCategory(activeCategory),
    [activeCategory],
  );

  const allCaseIds = useMemo(() => catalog.cases.map((c) => c.id), [catalog]);

  const categoryCaseIds = useMemo(
    () => casesInView.map((c) => c.id),
    [casesInView],
  );

  const selected = casesInView.find((c) => c.id === selectedId) || casesInView[0];
  const selectedProgress = selected ? getCaseRecord(selected.id) : null;
  const activeCategoryMeta = categories.find((c) => c.id === activeCategory);

  useEffect(() => {
    if (!casesInView.some((c) => c.id === selectedId) && casesInView[0]) {
      setSelectedId(casesInView[0].id);
    }
  }, [casesInView, selectedId]);

  const handleCategory = (id) => {
    setActiveCategory(id);
    const first = getCasesInCategory(id)[0];
    if (first) setSelectedId(first.id);
  };

  const playRandom = useCallback(
    (poolIds) => {
      const id = pickRandomId(poolIds.length ? poolIds : allCaseIds);
      const gameCase = id ? getCaseById(id) : null;
      if (gameCase) onPlay(gameCase, 'random');
    },
    [allCaseIds, onPlay],
  );

  const playShuffle = useCallback(() => {
    const firstId = startShuffleQueue(allCaseIds);
    const gameCase = firstId ? getCaseById(firstId) : null;
    if (gameCase) onPlay(gameCase, 'shuffle');
  }, [allCaseIds, onPlay]);

  const queuePos =
    progress.queue.length > 0
      ? `${progress.queueIndex + 1} / ${progress.queue.length}`
      : null;

  return (
    <main
      className="shell-home shell-cases"
      style={{
        ['--case-list-w']: `${layout.caseListWidthPx}px`,
        ['--preview-w']: `${layout.previewCardWidthPx}px`,
        ['--preview-h']: `${layout.previewCardHeightPx}px`,
        ['--case-row-h']: `${layout.caseRowHeightPx}px`,
      }}
    >
      <header className="shell-header shell-cases-header">
        <button type="button" className="btn-ghost welcome-back-btn" onClick={onBack}>
          ← Back
        </button>
        <h1 className="shell-cases-title">Cases</h1>
      </header>

      <section className="shell-categories-panel" aria-label="Case categories">
        <div className="shell-categories-head">
          <p className="shell-section-label">CCS categories</p>
          {activeCategoryMeta && (
            <p className="shell-active-category">
              Viewing <strong>{activeCategoryMeta.label}</strong> · {activeCategoryMeta.count} cases
            </p>
          )}
        </div>
        <div className="shell-categories">
          {categories.map((cat) => (
            <button
              key={cat.id}
              type="button"
              className={cat.id === activeCategory ? 'cat-chip active' : 'cat-chip'}
              onClick={() => handleCategory(cat.id)}
              aria-pressed={cat.id === activeCategory}
            >
              {cat.label}
              <span className="cat-count">{cat.count}</span>
            </button>
          ))}
        </div>
      </section>

      <div className="shell-toolbar shell-toolbar-modes">
        <button type="button" className="mode-btn mode-random" onClick={() => playRandom(categoryCaseIds)}>
          🎲 Random in {activeCategoryMeta?.label || 'category'}
        </button>
        <button type="button" className="mode-btn mode-random" onClick={() => playRandom(allCaseIds)}>
          🎲 Random (all {catalog.totalCases})
        </button>
        <button type="button" className="mode-btn mode-shuffle" onClick={playShuffle}>
          🔀 Shuffle all cases
        </button>
        {queuePos && (
          <span className="queue-badge" title="Shuffle queue position">
            Queue {queuePos}
          </span>
        )}
      </div>

      <div className="shell-body">
        <aside className="shell-list-col">
          {activeCategoryMeta && (
            <div className="shell-list-header">
              <h2 className="shell-list-category">{activeCategoryMeta.label}</h2>
              <p className="shell-list-category-meta">{activeCategoryMeta.count} cases in this category</p>
            </div>
          )}
          <div className="shell-list" role="listbox" aria-label={`Cases in ${activeCategoryMeta?.label || 'category'}`}>
            {casesInView.map((c) => {
              const rec = getCaseRecord(c.id);
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={c.id === selectedId}
                  className={`case-row ${c.id === selectedId ? 'selected' : ''} ${rec?.completed ? 'case-done' : ''}`}
                  onClick={() => setSelectedId(c.id)}
                >
                  <span className="case-num">#{c.ccsNumber}</span>
                  <span className="case-name" title={c.title}>
                    {c.title}
                  </span>
                  <span className="case-meta">
                    {rec?.completed ? (
                      <span className="case-check" title={`Best ${rec.bestAccuracy}%`}>
                        ✓ {rec.bestAccuracy}%
                      </span>
                    ) : rec?.plays ? (
                      <span className="case-tried">{rec.bestAccuracy}%</span>
                    ) : (
                      c.timeLimit?.replace(' Case', '')
                    )}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        <section className="shell-detail">
          {selected && (
            <div className="case-preview-card">
              {selected.category && <p className="preview-category">{selected.category}</p>}
              <p className="preview-label">Case {selected.ccsNumber}</p>
              <h2 className="preview-title" title={selected.title}>
                {selected.title}
              </h2>
              {selectedProgress && (
                <p className="preview-track">
                  Played {selectedProgress.plays}× · best {selectedProgress.bestAccuracy}%
                  {selectedProgress.completed ? ' · mastered' : ''}
                </p>
              )}
              <p className="preview-tip" title={selected.clinical_tip}>
                {selected.clinical_tip}
              </p>
              <p className="preview-obj" title={selected.objective}>
                {selected.objective}
              </p>
              <button
                type="button"
                className="btn-play btn-play-block"
                onClick={() => {
                  setLastMode('browse');
                  onPlay(selected, 'browse');
                }}
              >
                ▶ Play case
              </button>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
