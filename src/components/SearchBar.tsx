import { useEffect, useState } from "react";

export function SearchBar({ initialQ, initialLoc, onSearch }: { initialQ?: string; initialLoc?: string; onSearch: (q: string, loc: string) => void }) {
  const [q, setQ] = useState(initialQ || "");
  const [loc, setLoc] = useState(initialLoc || "");

  useEffect(() => setQ(initialQ || ""), [initialQ]);
  useEffect(() => setLoc(initialLoc || ""), [initialLoc]);
  return (
    <form
      className="topcv-search"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q.trim(), loc.trim());
      }}
    >
      <div className="topcv-search-field">
        <span className="topcv-search-icon">⌕</span>
        <input aria-label="Từ khóa" className="topcv-search-input" placeholder="Vị trí tuyển dụng, tên công ty" value={q} onChange={(e) => setQ(e.target.value)} />
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
