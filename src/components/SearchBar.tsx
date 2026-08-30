import { useEffect, useState } from "react";

export function SearchBar({ initialQ, initialLoc, onSearch }: { initialQ?: string; initialLoc?: string; onSearch: (q: string, loc: string) => void }) {
  const [q, setQ] = useState(initialQ || "");
  const [loc, setLoc] = useState(initialLoc || "");

  useEffect(() => setQ(initialQ || ""), [initialQ]);
  useEffect(() => setLoc(initialLoc || ""), [initialLoc]);
  return (
    <form
      className="search-bar"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q.trim(), loc.trim());
      }}
    >
      <div className="search-field">
        <span className="search-icon">🔍</span>
        <input aria-label="Từ khóa" className="input search-input" placeholder="Từ khóa: React, .NET, Marketing..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>
      <div className="search-field">
        <span className="search-icon">📍</span>
        <input aria-label="Địa điểm" className="input search-input" placeholder="Địa điểm: Hà Nội, HCM..." value={loc} onChange={(e) => setLoc(e.target.value)} />
      </div>
      <button className="btn btn-primary search-btn" type="submit">Tìm kiếm</button>
    </form>
  );
}
