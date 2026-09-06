import { useEffect, useRef, useState } from "react";
import { fetchSuggestions } from "../lib/jobsApi";

export function SearchBar({ initialQ, initialLoc, onSearch }: { initialQ?: string; initialLoc?: string; onSearch: (q: string, loc: string) => void }) {
  const [q, setQ] = useState(initialQ || "");
  const [loc, setLoc] = useState(initialLoc || "");
  const [suggests, setSuggests] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => setQ(initialQ || ""), [initialQ]);
  useEffect(() => setLoc(initialLoc || ""), [initialLoc]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function onQChange(v: string) {
    setQ(v);
    if (timer.current) clearTimeout(timer.current);
    if (!v.trim()) { setSuggests([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const items = await fetchSuggestions(v, 8);
      setSuggests(items);
      setOpen(items.length > 0);
    }, 350);
  }

  function pick(s: string) {
    setQ(s);
    setSuggests([]);
    setOpen(false);
    onSearch(s.trim(), loc.trim());
  }

  return (
    <form
      className="topcv-search"
      onSubmit={(e) => {
        e.preventDefault();
        setOpen(false);
        onSearch(q.trim(), loc.trim());
      }}
    >
      <div className="topcv-search-field" style={{ position: "relative" }}>
        <span className="topcv-search-icon">⌕</span>
        <input aria-label="Từ khóa" className="topcv-search-input" placeholder="Vị trí tuyển dụng, tên công ty" value={q} onChange={(e) => onQChange(e.target.value)} onFocus={() => setOpen(suggests.length > 0)} onBlur={() => setTimeout(() => setOpen(false), 150)} autoComplete="off" />
        {open && (
          <ul className="suggest-list" role="listbox" style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 20, background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, marginTop: 4, padding: 0, listStyle: "none", boxShadow: "0 8px 24px rgba(0,0,0,.08)" }}>
            {suggests.map((s) => (
              <li key={s}>
                <button type="button" role="option" aria-selected="false" onMouseDown={(e) => { e.preventDefault(); pick(s); }} style={{ width: "100%", textAlign: "left", background: "none", border: 0, padding: "8px 12px", cursor: "pointer", fontSize: 14 }}>
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="topcv-search-divider" />
      <div className="topcv-search-field topcv-search-field--loc">
        <input aria-label="Địa điểm" className="topcv-search-input" placeholder="Địa điểm" value={loc} onChange={(e) => setLoc(e.target.value)} />
        <span className="topcv-search-arrow">▾</span>
      </div>
      <button className="topcv-search-btn" type="submit">
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        </span>
      </button>
    </form>
  );
}
