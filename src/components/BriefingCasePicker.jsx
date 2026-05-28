import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FiChevronDown, FiChevronUp, FiSearch } from 'react-icons/fi';
import { getAllGameCases, getCategories, getCasesInCategory } from '../data/useCcsCatalog.js';
import { getCaseRecord } from '../data/caseProgress.js';
import { STORAGE } from '../lib/storageKeys.js';
import { getAllowedCaseIds, readAudienceProfile } from '../lib/audienceProfile.js';

const PICKER_WIDTH = 400;

function readPickerPos() {
  try {
    const raw = localStorage.getItem(STORAGE.briefingPickerPos);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (typeof parsed?.x === 'number' && typeof parsed?.y === 'number') {
        return parsed;
      }
    }
  } catch {
    /* ignore */
  }
  return {
    x: Math.max(12, window.innerWidth - PICKER_WIDTH - 24),
    y: 72,
  };
}

function writePickerPos(pos) {
  try {
    localStorage.setItem(STORAGE.briefingPickerPos, JSON.stringify(pos));
  } catch {
    /* ignore */
  }
}

export default function BriefingCasePicker({ currentCaseId, onSelectCase }) {
  const categories = getCategories();
  const audienceProfile = useMemo(() => readAudienceProfile(), []);
  const allCases = useMemo(() => getAllGameCases(), []);
  const allowedCaseIds = useMemo(
    () => getAllowedCaseIds(allCases, audienceProfile || { level: 'advanced', condition: 'diabetes' }),
    [allCases, audienceProfile],
  );
  const allowedSet = useMemo(() => new Set(allowedCaseIds), [allowedCaseIds]);
  const visibleAllCases = useMemo(() => allCases.filter((c) => allowedSet.has(c.id)), [allCases, allowedSet]);
  const visibleCategories = useMemo(
    () =>
      categories
        .map((cat) => ({
          ...cat,
          caseIds: (cat.caseIds || []).filter((id) => allowedSet.has(id)),
        }))
        .filter((cat) => cat.caseIds.length > 0),
    [categories, allowedSet],
  );
  const pickerRef = useRef(null);
  const dragRef = useRef({ dx: 0, dy: 0 });
  const [open, setOpen] = useState(true);
  const [pos, setPos] = useState(readPickerPos);
  const [dragging, setDragging] = useState(false);
  const [categoryId, setCategoryId] = useState(visibleCategories[0]?.id);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const cat = visibleCategories.find((c) => c.caseIds?.includes(currentCaseId));
    if (cat) setCategoryId(cat.id);
  }, [currentCaseId, visibleCategories]);

  const casesInCategory = useMemo(
    () => (categoryId ? getCasesInCategory(categoryId).filter((c) => allowedSet.has(c.id)) : []),
    [categoryId, allowedSet],
  );

  const filteredCases = useMemo(() => {
    const q = query.trim().toLowerCase();
    const pool = q ? visibleAllCases : casesInCategory;
    if (!q) return pool;
    return pool.filter((c) => {
      const num = String(c.ccsNumber || '');
      return (
        c.title.toLowerCase().includes(q) ||
        num.includes(q) ||
        (c.category || '').toLowerCase().includes(q) ||
        (c.chief_complaint || '').toLowerCase().includes(q)
      );
    });
  }, [visibleAllCases, casesInCategory, query]);

  const activeCategory = visibleCategories.find((c) => c.id === categoryId);

  const clampPos = useCallback((x, y) => {
    const width = pickerRef.current?.offsetWidth || PICKER_WIDTH;
    const height = pickerRef.current?.offsetHeight || 420;
    return {
      x: Math.min(Math.max(8, x), Math.max(8, window.innerWidth - width - 8)),
      y: Math.min(Math.max(8, y), Math.max(8, window.innerHeight - height - 8)),
    };
  }, []);

  useEffect(() => {
    if (!dragging) return undefined;

    const onMove = (event) => {
      const next = clampPos(
        event.clientX - dragRef.current.dx,
        event.clientY - dragRef.current.dy,
      );
      setPos(next);
    };

    const onUp = () => {
      setDragging(false);
      setPos((current) => {
        writePickerPos(current);
        return current;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, [dragging, clampPos]);

  useEffect(() => {
    const onResize = () => {
      setPos((current) => {
        const next = clampPos(current.x, current.y);
        writePickerPos(next);
        return next;
      });
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [clampPos]);

  const onDragStart = (event) => {
    if (event.button !== 0) return;
    const rect = pickerRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    dragRef.current = {
      dx: event.clientX - rect.left,
      dy: event.clientY - rect.top,
    };
    setDragging(true);
  };

  return (
    <aside
      ref={pickerRef}
      className={`briefing-picker ${open ? 'is-open' : ''} ${dragging ? 'is-dragging' : ''}`}
      style={{ left: `${pos.x}px`, top: `${pos.y}px` }}
      aria-label="Browse cases"
    >
      <div className="briefing-picker-head">
        <div
          className="briefing-picker-drag"
          onPointerDown={onDragStart}
          title="Drag to reposition"
          role="presentation"
        >
          <span className="briefing-picker-grip" aria-hidden>
            ⋮⋮
          </span>
          <span>Switch case</span>
        </div>
        <button
          type="button"
          className="briefing-picker-collapse"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? 'Collapse case list' : 'Expand case list'}
        >
          {open ? <FiChevronUp aria-hidden /> : <FiChevronDown aria-hidden />}
        </button>
      </div>

      {open && (
        <div className="briefing-picker-panel">
          <label className="briefing-picker-field">
            <span className="briefing-picker-label">Category</span>
            <select
              className="briefing-picker-select"
              value={categoryId || ''}
              onChange={(e) => {
                setCategoryId(e.target.value);
                setQuery('');
              }}
            >
              {visibleCategories.map((cat) => (
                <option key={cat.id} value={cat.id}>
                  {cat.label} ({cat.caseIds.length})
                </option>
              ))}
            </select>
          </label>

          <label className="briefing-picker-field briefing-picker-search">
            <span className="briefing-picker-label">Search</span>
            <span className="briefing-picker-search-wrap">
              <FiSearch className="briefing-picker-search-icon" aria-hidden />
              <input
                type="search"
                className="briefing-picker-input"
                placeholder="Search by name or case #…"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
              />
            </span>
          </label>

          <p className="briefing-picker-meta">
            {query.trim()
              ? `${filteredCases.length} match${filteredCases.length === 1 ? '' : 'es'} · all categories`
              : activeCategory
                ? `${filteredCases.length} of ${activeCategory.count} · ${activeCategory.label}`
                : ''}
            {!query.trim() ? ' · click a case to switch' : ''}
          </p>

          <div className="briefing-picker-list" role="listbox" aria-label="Cases in category">
            {filteredCases.length === 0 && (
              <p className="briefing-picker-empty">No cases match your search.</p>
            )}
            {filteredCases.map((c) => {
              const rec = getCaseRecord(c.id);
              const selected = c.id === currentCaseId;
              return (
                <button
                  key={c.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  className={`briefing-picker-row ${selected ? 'selected' : ''} ${rec?.completed ? 'done' : ''}`}
                  onClick={() => onSelectCase(c)}
                  title={`Switch to ${c.title}`}
                >
                  <span className="briefing-picker-num">#{c.ccsNumber}</span>
                  <span className="briefing-picker-name" title={c.title}>
                    {c.title}
                    {query.trim() && c.category ? (
                      <span className="briefing-picker-cat"> · {c.category}</span>
                    ) : null}
                  </span>
                  <span className="briefing-picker-status">
                    {rec?.completed ? `✓ ${rec.bestAccuracy}%` : rec?.plays ? `${rec.bestAccuracy}%` : '—'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </aside>
  );
}
