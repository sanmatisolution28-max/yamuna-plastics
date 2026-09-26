import React, { useEffect, useMemo, useRef, useState } from 'react';

const inr = (n) => {
  const num = Number(n || 0);
  return num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
};

export default function ProductPicker({ items = [], itemId, value, onSelect, onCustom, disabled }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState(null);
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
    const reposition = () => place();
    document.addEventListener('mousedown', onDocDown);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      document.removeEventListener('mousedown', onDocDown);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (open && searchRef.current) searchRef.current.focus();
  }, [open]);

  useEffect(() => {
    setActiveIdx(0);
  }, [query]);

  // The table wrapper scrolls, which would clip an absolutely-positioned panel.
  // So the panel is placed with fixed coordinates: it opens fully clear of the row,
  // flips above the field when the space below is too small, and never needs the
  // inner list to scroll for a normal catalog.
  const place = () => {
    const el = wrapRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.max(rect.width, 240);
    const left = Math.min(Math.max(8, rect.left), Math.max(8, vw - width - 8));
    const below = vh - rect.bottom;
    const above = rect.top;
    const dropUp = below < 300 && above > below;
    setPos({
      dropUp,
      left,
      width,
      top: dropUp ? undefined : rect.bottom + 5,
      bottom: dropUp ? vh - rect.top + 5 : undefined,
      maxH: Math.max(140, (dropUp ? above : below) - 16)
    });
  };

  const openMenu = () => {
    if (disabled) return;
    place();
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

      {open && pos && (
        <div
          className={`product-picker-panel${pos.dropUp ? ' is-up' : ''}`}
          style={{
            left: pos.left,
            width: pos.width,
            top: pos.top,
            bottom: pos.bottom,
            '--pp-max-h': `${pos.maxH}px`
          }}
        >
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
                  title={it.name}
                  className={`pp-option${i === activeIdx ? ' is-active' : ''}${isSel ? ' is-selected' : ''}`}
                  onMouseEnter={() => setActiveIdx(i)}
                  onMouseDown={(e) => e.preventDefault()}
                  onClick={() => choose(it)}
                >
                  <span className="pp-option-name">{it.name}</span>
                  <span className="pp-option-rate">
                    ₹{inr(it.baseRate || it.rate)}/{it.unit || 'KGS'}
                  </span>
                  {it.hsn ? <span className="pp-option-hsn">HSN {it.hsn}</span> : null}
                  {isSel ? <span className="pp-tick" aria-hidden="true">✓</span> : null}
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
