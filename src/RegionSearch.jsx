import { useMemo, useState } from 'react';

const normalize = (s) => s.replace(/\s+/g, '');

export default function RegionSearch({ regions, onSelect }) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);

  const results = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return regions.filter((r) => normalize(r.fullName).includes(q)).slice(0, 8);
  }, [regions, query]);

  const choose = (r) => {
    if (!r) return;
    onSelect(r.code);
    setQuery('');
    setOpen(false);
  };

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      choose(results[active]);
    } else if (e.key === 'Escape') {
      setOpen(false);
    }
  };

  return (
    <div className="search">
      <svg className="search-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
        <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
        <path d="m20 20-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <input
        type="search"
        placeholder="지역 검색 (예: 강릉, 해운대)"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setActive(0);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={onKeyDown}
        aria-label="지역 검색"
      />
      {open && query && (
        <ul className="search-results" role="listbox">
          {results.length === 0 && <li className="search-empty">일치하는 지역이 없습니다</li>}
          {results.map((r, i) => (
            <li
              key={r.code}
              role="option"
              aria-selected={i === active}
              className={i === active ? 'active' : ''}
              onMouseDown={(e) => e.preventDefault()}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
            >
              <span>{r.name}</span>
              <small>{r.sido}</small>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
