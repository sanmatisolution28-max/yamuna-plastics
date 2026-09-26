import React, { useEffect, useMemo, useRef, useState } from 'react';

const inr = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

export default function ProductPicker({ items = [], itemId, value, onSelect, onCustom, disabled }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const wrapRef = useRef(null);
  const searchRef = useRef(null);

  const catalog = useMemo(() => (items || []).filter((it) => it && it.name), [items]);

  // Resolve the chosen product by stable id; fall back to name for older saved bills.
  const selected = useMemo(() => {
    if (itemId) {
      const byId = catalog.find((it) => it.id === itemId);
      if (byId) return byId;
    }
    if (value) return catalog.find((it) => it.name === value) || null;
    return null;
  }, [catalog, itemId, value]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return catalog;
    return catalog.filter((it) => {
      const name = String(it.name || '').toLowerCase();
      const hsn = String(it.hsn || '').toLowerCase();
      const cat = String(it.category || '').toLowerCase();
      return name.includes(q) || hsn.includes(q) || cat.includes(q);
    });
  }, [catalog, query]);

  useEffect(() => {
    if (!open) return undefined;
    const onDocDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocDown);
    return () => document.removeEventListener('mousedown', onDocDown);
  }, [open]);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  const openMenu = () => {
    if (disabled) return;
    setQuery('');
    setActiveIdx(0);
    setOpen(true);
  };

  const choose = (item) => {
    onSelect(item);
    setOpen(false);
    setQuery('');
  };

  const onKeyDown = (e) => {
    if (e.key === 'Escape') {
      setOpen(false);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) {
        openMenu();
        return;
      }
      setActiveIdx((i) => Math.min(i + 1, filtered.length - 1));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter') {
      if (!open) {
        e.preventDefault();
        openMenu();
        return;
      }
      if (filtered[activeIdx]) {
        e.preventDefault();
        e.stopPropagation();
        choose(filtered[activeIdx]);
      }
    }
  };

  return (
    <div className="product-picker" ref={wrapRef}>
      <div
        className={`product-picker-control${open ? ' is-open' : ''}${selected ? ' has-value' : ''}`}
        onClick={openMenu}
        onKeyDown={onKeyDown}
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        tabIndex={0}
      >
        <div className="product-picker-text">
          {selected ? (
            <>
              <span className="pp-name">{selected.name}</span>
              <span className="pp-meta">
                ₹{inr(selected.baseRate || selected.rate)} / {selected.unit || 'KGS'}
                {selected.hsn ? <em> · HSN {selected.hsn}</em> : null}
              </span>
            </>
          ) : (
            <span className="pp-placeholder">
              {catalog.length > 0
                ? `Select a product (${catalog.length} available)`
                : 'No products synced from Tally yet'}
            </span>
          )}
        </div>
        <span className={`product-picker-caret${open ? ' up' : ''}`} aria-hidden="true" />
      </div>

      {open && (
        <div className="product-picker-panel">
          <div className="pp-search-row">
            <input
              ref={searchRef}
              className="pp-search"
              type="text"
              value={query}
              placeholder="Search product, HSN or category…"
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onKeyDown}
            />
            <span className="pp-count">{filtered.length}</span>
          </div>

          <ul className="pp-list" role="listbox">
            {filtered.length === 0 && (
              <li className="pp-empty">No product matches “{query}”.</li>
            )}
            {filtered.map((it, i) => {
              const isSel = selected && selected.id === it.id;
              return (
                <li
                  key={it.id || it.name}
                  role="option"
                  aria-selected={isSel}
                  className={`pp-option${i === activeIdx ? ' is-active' : ''}${isSel ? ' is-selected' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(it)}
                >
                  <span className="pp-option-main">
                    <span className="pp-option-name">{it.name}</span>
                    <span className="pp-option-sub">
                      ₹{inr(it.baseRate || it.rate)} / {it.unit || 'KGS'}
                      {it.hsn ? ` · HSN ${it.hsn}` : ''}
                      {it.category ? ` · ${it.category}` : ''}
                    </span>
                  </span>
                  {isSel && <span className="pp-tick" aria-hidden="true">✓</span>}
                </li>
              );
            })}
          </ul>

          <div className="pp-footer">
            <button
              type="button"
              className="pp-custom-btn"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                setOpen(false);
                if (onCustom) onCustom();
              }}
            >
              ✏️ Type product manually
            </button>
            <span className="pp-hint">↑↓ navigate · Enter select · Esc close</span>
          </div>
        </div>
      )}
    </div>
  );
}
