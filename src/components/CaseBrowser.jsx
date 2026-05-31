import { useState, useMemo, useCallback, useEffect } from 'react';

import { getCatalog, getCategories, getCasesInCategory, getCaseById } from '../data/useCcsCatalog.js';

import { getLayout } from '../data/gameData.js';

import {

  readProgress,

  getCaseRecord,

  getCompletionStats,

  getFlaggedCaseIds,

  pickRandomId,

  startShuffleQueue,

  setLastMode,

} from '../data/caseProgress.js';

import {
  getReadyPracticeCases,
  getReadyPracticeCount,
  getReadyPracticeDiagnosis,
  getStackTestingCases,
  getStackTestingCount,
  getCaseStackCount,
  STACK_TESTING_MIN_ORDERS,
} from '../lib/caseReadyPractice.js';

import { hasCaseSpecificPlaybook } from '../data/resolvePlaybook.js';

import CaseProgressTag from './CaseProgressTag.jsx';

import CaseReadyTag from './CaseReadyTag.jsx';

import CaseReviewFlagButton from './CaseReviewFlagButton.jsx';

import CaseReviewFlagTag from './CaseReviewFlagTag.jsx';



export default function CaseBrowser({ onPlay, onBack, initialFilter = 'all' }) {

  const catalog = getCatalog();

  const categories = getCategories();

  const layout = getLayout();

  const readyCount = getReadyPracticeCount();

  const readyCases = useMemo(() => getReadyPracticeCases(catalog.cases), [catalog.cases]);

  const readyIds = useMemo(() => readyCases.map((c) => c.id), [readyCases]);

  const stackTestingCases = useMemo(() => getStackTestingCases(catalog.cases), [catalog.cases]);

  const stackTestingCount = useMemo(() => getStackTestingCount(catalog.cases), [catalog.cases]);

  const stackTestingIds = useMemo(() => stackTestingCases.map((c) => c.id), [stackTestingCases]);



  const [listFilter, setListFilter] = useState(() =>

    initialFilter === 'ready'
      ? 'ready'
      : initialFilter === 'stacks'
        ? 'stacks'
        : initialFilter === 'flagged'
          ? 'flagged'
          : 'all',

  );

  const [activeCategory, setActiveCategory] = useState(categories[0]?.id);

  const [selectedId, setSelectedId] = useState(() => {

    if (initialFilter === 'ready') return readyCases[0]?.id || '001';

    if (initialFilter === 'stacks') return stackTestingCases[0]?.id || '138';

    if (initialFilter === 'flagged') return getFlaggedCaseIds()[0] || readyCases[0]?.id || '001';

    return categories[0]?.caseIds?.[0] || '001';

  });

  const progress = useMemo(() => readProgress(), []);

  const [flagVersion, setFlagVersion] = useState(0);

  const flaggedIds = useMemo(() => {
    void flagVersion;
    return getFlaggedCaseIds();
  }, [flagVersion]);

  const flaggedCount = useMemo(() => flaggedIds.length, [flaggedIds]);

  const flaggedCases = useMemo(() => {
    const byId = new Map(catalog.cases.map((c) => [c.id, c]));
    return flaggedIds.map((id) => byId.get(id)).filter(Boolean);
  }, [catalog.cases, flaggedIds]);

  const overallStats = useMemo(() => getCompletionStats(catalog.totalCases), [catalog.totalCases]);



  const casesInView = useMemo(() => {

    if (listFilter === 'ready') return readyCases;

    if (listFilter === 'stacks') return stackTestingCases;

    if (listFilter === 'flagged') return flaggedCases;

    return getCasesInCategory(activeCategory);

  }, [listFilter, activeCategory, readyCases, stackTestingCases, flaggedCases]);



  const allCaseIds = useMemo(() => catalog.cases.map((c) => c.id), [catalog]);



  const categoryCaseIds = useMemo(

    () => casesInView.map((c) => c.id),

    [casesInView],

  );



  const selected = casesInView.find((c) => c.id === selectedId) || casesInView[0];

  const selectedGameCase = selected ? getCaseById(selected.id) : null;

  const selectedProgress = selected ? getCaseRecord(selected.id) : null;

  const activeCategoryMeta = categories.find((c) => c.id === activeCategory);

  const selectedDiagnosis =

    selectedGameCase?.diagnosis || getReadyPracticeDiagnosis(selected?.id) || null;



  useEffect(() => {

    if (!casesInView.some((c) => c.id === selectedId) && casesInView[0]) {

      setSelectedId(casesInView[0].id);

    }

  }, [casesInView, selectedId]);



  const handleCategory = (id) => {

    setListFilter('all');

    setActiveCategory(id);

    const first = getCasesInCategory(id)[0];

    if (first) setSelectedId(first.id);

  };



  const showReadyFilter = () => {

    setListFilter('ready');

    if (readyCases[0]) setSelectedId(readyCases[0].id);

  };



  const showStackFilter = () => {

    setListFilter('stacks');

    if (stackTestingCases[0]) setSelectedId(stackTestingCases[0].id);

  };



  const showFlaggedFilter = () => {

    setListFilter('flagged');

    const ids = getFlaggedCaseIds();

    if (ids[0]) setSelectedId(ids[0]);

  };



  const playCase = useCallback(

    (gameCase) => {

      if (!gameCase) return;

      setLastMode('browse');

      onPlay(gameCase, 'browse');

    },

    [onPlay],

  );



  const playRandom = useCallback(

    (poolIds) => {

      const id = pickRandomId(poolIds.length ? poolIds : allCaseIds);

      const gameCase = id ? getCaseById(id) : null;

      playCase(gameCase);

    },

    [allCaseIds, playCase],

  );



  const playShuffle = useCallback(() => {

    const pool =

      listFilter === 'ready'

        ? readyIds

        : listFilter === 'stacks'

          ? stackTestingIds

          : listFilter === 'flagged'

            ? flaggedIds

            : allCaseIds;

    const firstId = startShuffleQueue(pool);

    const gameCase = firstId ? getCaseById(firstId) : null;

    playCase(gameCase);

  }, [allCaseIds, listFilter, readyIds, stackTestingIds, flaggedIds, playCase]);



  const playNextFlagged = useCallback(() => {

    const next =

      flaggedCases.find((c) => c.id === selectedId) ||

      flaggedCases[0];

    playCase(next ? getCaseById(next.id) : null);

  }, [flaggedCases, selectedId, playCase]);



  const playNextReady = useCallback(() => {

    const next =

      readyCases.find((c) => !getCaseRecord(c.id)?.completed) ||

      readyCases.find((c) => c.id === selectedId) ||

      readyCases[0];

    playCase(next ? getCaseById(next.id) : null);

  }, [readyCases, selectedId, playCase]);



  const playNextStack = useCallback(() => {

    const next =

      stackTestingCases.find((c) => !getCaseRecord(c.id)?.completed) ||

      stackTestingCases.find((c) => c.id === selectedId) ||

      stackTestingCases[0];

    playCase(next ? getCaseById(next.id) : null);

  }, [stackTestingCases, selectedId, playCase]);



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

        <span className="shell-cases-completion" title="Cases mastered / total">

          {overallStats.completed}/{overallStats.total} mastered

        </span>

      </header>



      <section className="shell-ready-filter" aria-label="Practice filters">

        <button

          type="button"

          className={listFilter === 'ready' ? 'ready-filter-chip active' : 'ready-filter-chip'}

          onClick={showReadyFilter}

          aria-pressed={listFilter === 'ready'}

        >

          Ready to practice

          <span className="ready-filter-count">{readyCount}</span>

        </button>

        <button

          type="button"

          className={listFilter === 'stacks' ? 'ready-filter-chip active' : 'ready-filter-chip'}

          onClick={showStackFilter}

          aria-pressed={listFilter === 'stacks'}

        >

          Stack testing

          <span className="ready-filter-count">{stackTestingCount}</span>

        </button>

        <button

          type="button"

          className={listFilter === 'flagged' ? 'ready-filter-chip active' : 'ready-filter-chip'}

          onClick={showFlaggedFilter}

          aria-pressed={listFilter === 'flagged'}

        >

          Review next

          <span className="ready-filter-count">{flaggedCount}</span>

        </button>

        <button

          type="button"

          className={listFilter === 'all' ? 'ready-filter-chip active' : 'ready-filter-chip'}

          onClick={() => setListFilter('all')}

          aria-pressed={listFilter === 'all'}

        >

          All {catalog.totalCases} cases

        </button>

        {listFilter === 'ready' && (

          <p className="ready-filter-note">

            Case-specific CCS stacks from your study guides — pick any row below (not random).

          </p>

        )}

        {listFilter === 'stacks' && (

          <p className="ready-filter-note">

            Largest authored stacks ({STACK_TESTING_MIN_ORDERS}+ orders) — stress-test drag placement and sequencing.

          </p>

        )}

        {listFilter === 'flagged' && (

          <p className="ready-filter-note">

            Cases you bookmarked during play — revisit before your exam.

          </p>

        )}

      </section>



      {listFilter === 'all' && (

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

      )}



      <div className="shell-toolbar shell-toolbar-modes">

        {listFilter === 'ready' ? (

          <>

            <button type="button" className="mode-btn mode-ready" onClick={playNextReady}>

              ▶ Start next ready case

            </button>

            <button type="button" className="mode-btn mode-shuffle" onClick={playShuffle}>

              🔀 Shuffle ready cases only

            </button>

          </>

        ) : listFilter === 'stacks' ? (

          <>

            <button type="button" className="mode-btn mode-ready" onClick={playNextStack}>

              ▶ Start next stack case

            </button>

            <button type="button" className="mode-btn mode-shuffle" onClick={playShuffle}>

              🔀 Shuffle stack cases only

            </button>

          </>

        ) : listFilter === 'flagged' ? (

          <>

            <button type="button" className="mode-btn mode-ready" onClick={playNextFlagged} disabled={!flaggedCount}>

              ▶ Start next flagged case

            </button>

            <button type="button" className="mode-btn mode-shuffle" onClick={playShuffle} disabled={!flaggedCount}>

              🔀 Shuffle flagged only

            </button>

          </>

        ) : (

          <>

            <button type="button" className="mode-btn mode-random" onClick={() => playRandom(categoryCaseIds)}>

              🎲 Random in {activeCategoryMeta?.label || 'category'}

            </button>

            <button type="button" className="mode-btn mode-random" onClick={() => playRandom(allCaseIds)}>

              🎲 Random (all {catalog.totalCases})

            </button>

            <button type="button" className="mode-btn mode-shuffle" onClick={playShuffle}>

              🔀 Shuffle all cases

            </button>

          </>

        )}

        {queuePos && (

          <span className="queue-badge" title="Shuffle queue position">

            Queue {queuePos}

          </span>

        )}

      </div>



      <div className="shell-body">

        <aside className="shell-list-col">

          <div className="shell-list-header">

            <h2 className="shell-list-category">

              {listFilter === 'ready'

                ? 'Ready to practice'

                : listFilter === 'stacks'

                  ? 'Stack testing'

                  : listFilter === 'flagged'

                    ? 'Review next'

                    : activeCategoryMeta?.label}

            </h2>

            <p className="shell-list-category-meta">

              {listFilter === 'ready'

                ? `${readyCount} cases with case-specific stacks`

                : listFilter === 'stacks'

                  ? `${stackTestingCount} cases · ${STACK_TESTING_MIN_ORDERS}–10 orders each`

                  : listFilter === 'flagged'

                    ? flaggedCount

                      ? `${flaggedCount} bookmarked case${flaggedCount === 1 ? '' : 's'}`

                      : 'Flag cases during play to build your review list'

                    : `${activeCategoryMeta?.count || 0} cases in this category`}

            </p>

          </div>

          <div

            className="shell-list"

            role="listbox"

            aria-label={

              listFilter === 'ready'

                ? 'Ready to practice cases'

                : listFilter === 'stacks'

                  ? 'Stack testing cases'

                  : listFilter === 'flagged'

                    ? 'Flagged review cases'

                    : `Cases in ${activeCategoryMeta?.label || 'category'}`

            }

          >

            {casesInView.map((c) => {

              const rec = getCaseRecord(c.id);

              const rowState = rec?.completed ? 'case-done' : rec?.plays ? 'case-attempted' : '';

              const isReady = hasCaseSpecificPlaybook(c.id);

              const stackCount = getCaseStackCount(c.id);

              const flagged = Boolean(rec?.reviewNext);

              return (

                <button

                  key={c.id}

                  type="button"

                  role="option"

                  aria-selected={c.id === selectedId}

                  className={`case-row ${c.id === selectedId ? 'selected' : ''} ${rowState} ${isReady ? 'case-row-ready' : ''} ${flagged ? 'case-row-flagged' : ''}`}

                  onClick={() => setSelectedId(c.id)}

                >

                  <span className="case-num">#{c.ccsNumber}</span>

                  <span className="case-name" title={c.title}>

                    {c.title}

                  </span>

                  <span className="case-meta case-meta-tags">

                    {listFilter === 'stacks' && stackCount > 0 && (

                      <span className="case-stack-count">{stackCount} orders</span>

                    )}

                    {flagged && <CaseReviewFlagTag compact />}

                    {isReady && <CaseReadyTag compact />}

                    <CaseProgressTag record={rec} showNew />

                  </span>

                </button>

              );

            })}

          </div>

        </aside>



        <section className="shell-detail">

          {selected && selectedGameCase && (

            <div className="case-preview-card">

              {listFilter === 'stacks' && selected && (
                <p className="preview-stack-banner">
                  Stack testing · {getCaseStackCount(selected.id)} orders to place
                </p>
              )}

              {hasCaseSpecificPlaybook(selected.id) && (

                <p className="preview-ready-banner">

                  <CaseReadyTag />

                </p>

              )}

              {selectedDiagnosis && (

                <p className="preview-diagnosis">CCS track: {selectedDiagnosis}</p>

              )}

              {selected.category && <p className="preview-category">{selected.category}</p>}

              <p className="preview-label">Case {selected.ccsNumber}</p>

              <h2 className="preview-title" title={selected.title}>

                {selected.title}

              </h2>

              <p className="preview-stack-count">

                {selectedGameCase.interventions?.length || 0} orders in this stack

              </p>

              {selectedProgress && (

                <p className="preview-track">

                  Played {selectedProgress.plays}× · best {selectedProgress.bestAccuracy}%

                  {selectedProgress.completed ? ' · mastered' : ''}

                </p>

              )}

              <p className="preview-tip" title={selectedGameCase.clinical_tip}>

                {selectedGameCase.clinical_tip}

              </p>

              <p className="preview-obj" title={selectedGameCase.objective}>

                {selectedGameCase.objective}

              </p>

              <CaseReviewFlagButton

                caseId={selected.id}

                onChange={() => setFlagVersion((v) => v + 1)}

              />

              <button

                type="button"

                className="btn-play btn-play-block"

                onClick={() => playCase(selectedGameCase)}

              >

                ▶ Play case #{selected.ccsNumber}

              </button>

            </div>

          )}

        </section>

      </div>

    </main>

  );

}


