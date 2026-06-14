import { useState, useEffect, useRef, useCallback } from 'react';
import { Search, X, Users, BookOpen, UserCheck, CalendarDays, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../lib/api.js';
import { formatDate } from '../lib/format.js';

export const ICONS = {
  students: Users,
  subjects: BookOpen,
  faculty: UserCheck,
  cycles: CalendarDays,
};

export const LABELS = {
  students: 'Students',
  subjects: 'Subjects',
  faculty: 'Faculty',
  cycles: 'Exam Cycles',
};

export function getResultLink(type, item) {
  if (type === 'cycles') return `/exam-cycles`;
  if (type === 'students') return `/students`;
  if (type === 'subjects') return `/subjects`;
  if (type === 'faculty') return `/faculty`;
  return '/';
}

export function getResultSub(type, item) {
  if (type === 'students') return `${item.prn} · ${item.branch} ${item.year} Sem ${item.semester}`;
  if (type === 'subjects') return `${item.code} · ${item.branch} ${item.year} Sem ${item.semester}`;
  if (type === 'faculty') return item.email;
  if (type === 'cycles') return `${formatDate(item.start_date)} → ${formatDate(item.end_date)} · ${item.status}`;
  return '';
}

export default function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState({ students: [], subjects: [], faculty: [], cycles: [] });
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);
  const inputRef = useRef(null);
  const navigate = useNavigate();
  const debounceRef = useRef(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const search = useCallback(async (q) => {
    if (q.trim().length < 2) {
      setResults({ students: [], subjects: [], faculty: [], cycles: [] });
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const { data } = await api.get(`/search?q=${encodeURIComponent(q)}`);
      setResults(data);
      setActiveIdx(-1);
    } catch {
      setResults({ students: [], subjects: [], faculty: [], cycles: [] });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleChange = (e) => {
    const q = e.target.value;
    setQuery(q);
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => search(q), 250);
  };

  const totalResults = Object.values(results).reduce((s, arr) => s + arr.length, 0);

  // Flatten results for keyboard nav
  const flatResults = [];
  for (const type of ['students', 'subjects', 'faculty', 'cycles']) {
    for (const item of results[type]) {
      flatResults.push({ type, item });
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatResults.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, -1));
    } else if (e.key === 'Enter' && activeIdx >= 0) {
      const { type, item } = flatResults[activeIdx];
      navigate(getResultLink(type, item));
    } else if (e.key === 'Escape') {
      navigate(-1);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Search Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: '#0C0C0E', paddingBottom: 24,
        borderBottom: '2px solid #111', marginBottom: 32,
      }}>
        <div className="accent-bar" style={{ marginBottom: 16 }} />
        <h1 className="page-title" style={{ marginBottom: 20 }}>Search</h1>

        <div style={{ position: 'relative' }}>
          <Search
            size={16} strokeWidth={1.5}
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: '#A3A3AC', pointerEvents: 'none' }}
          />
          <input
            ref={inputRef}
            value={query}
            onChange={handleChange}
            onKeyDown={handleKeyDown}
            placeholder="Search students, subjects, faculty, exam cycles…"
            style={{
              width: '100%', padding: '14px 42px 14px 44px',
              border: '2px solid #111', borderRadius: 0, outline: 'none',
              fontFamily: 'var(--font-body)', fontSize: 15,
              background: '#fff', color: '#111',
              boxSizing: 'border-box',
            }}
          />
          {query && (
            <button
              onClick={() => { setQuery(''); setResults({ students: [], subjects: [], faculty: [], cycles: [] }); inputRef.current?.focus(); }}
              style={{ position: 'absolute', right: 14, top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#A3A3AC', display: 'flex', alignItems: 'center' }}
            >
              <X size={14} strokeWidth={1.5} />
            </button>
          )}
        </div>

        {query.length >= 2 && (
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'var(--np-n500)', marginTop: 8, display: 'flex', gap: 16 }}>
            {loading ? 'Searching…' : `${totalResults} result${totalResults !== 1 ? 's' : ''} · ↑↓ navigate · Enter to open · Esc to go back`}
          </div>
        )}
      </div>

      {/* Empty state */}
      {!query && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--np-n500)' }}>
          <Search size={32} strokeWidth={1} style={{ marginBottom: 16, opacity: 0.3 }} />
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 14, fontStyle: 'italic' }}>
            Start typing to search across all records
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, marginTop: 8, opacity: 0.6 }}>
            Ctrl+K · minimum 2 characters
          </div>
        </div>
      )}

      {/* Results */}
      {query.length >= 2 && !loading && totalResults === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 0', color: 'var(--np-n500)', fontFamily: 'var(--font-body)', fontStyle: 'italic' }}>
          No results for "{query}"
        </div>
      )}

      {['students', 'subjects', 'faculty', 'cycles'].map(type => {
        const items = results[type];
        if (!items.length) return null;
        const Icon = ICONS[type];

        return (
          <div key={type} style={{ marginBottom: 32 }}>
            <div style={{
              fontFamily: 'var(--font-mono)', fontSize: 9, textTransform: 'uppercase',
              letterSpacing: '0.12em', color: 'var(--np-n500)',
              borderBottom: '1px solid #222225', paddingBottom: 8, marginBottom: 12,
              display: 'flex', alignItems: 'center', gap: 8,
            }}>
              <Icon size={11} strokeWidth={1.5} />
              {LABELS[type]} — {items.length} result{items.length !== 1 ? 's' : ''}
            </div>
            <div style={{ border: '1px solid #222225' }}>
              {items.map((item, i) => {
                const globalIdx = flatResults.findIndex(r => r.type === type && r.item.id === item.id);
                const isActive = activeIdx === globalIdx;
                return (
                  <button
                    key={item.id}
                    onClick={() => navigate(getResultLink(type, item))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 16, width: '100%',
                      padding: '12px 16px', border: 'none', textAlign: 'left', cursor: 'pointer',
                      background: isActive ? '#111' : 'transparent',
                      color: isActive ? '#0C0C0E' : '#111',
                      borderBottom: i < items.length - 1 ? '1px solid #222225' : 'none',
                      transition: 'background 0.1s',
                    }}
                  >
                    <Icon size={13} strokeWidth={1.5} style={{ flexShrink: 0, opacity: 0.6 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 2 }}>{item.name}</div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, opacity: 0.65 }}>
                        {getResultSub(type, item)}
                      </div>
                    </div>
                    <ArrowRight size={12} strokeWidth={1.5} style={{ opacity: 0.4 }} />
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}









