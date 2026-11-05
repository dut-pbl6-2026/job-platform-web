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
        <input aria-label="Từ khóa" className="topcv-search-input" placeholder="Vị trí tuyển dụng, tên công ty" value={q} onChange={(e) => setQ(e.target.value)} autoComplete="off" />
      </div>
      <div className="topcv-search-divider" />
      <div className="topcv-search-field topcv-search-field--loc">
        <span className="topcv-search-icon" aria-hidden="true">⌖</span>
        <input aria-label="Địa điểm" className="topcv-search-input" placeholder="Địa điểm" value={loc} onChange={(e) => setLoc(e.target.value)} />
        <span className="topcv-search-arrow">▾</span>
      </div>
      <button className="topcv-search-btn" type="submit">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.4" aria-hidden="true"><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></svg>
        Tìm kiếm
      </button>
    </form>
  );
}
