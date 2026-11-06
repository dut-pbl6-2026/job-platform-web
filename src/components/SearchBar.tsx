import { useEffect, useState } from "react";
import { Icon } from "./ui";
import { LOCATION_SUGGESTIONS } from "../lib/searchFilters";

/** Keyword + place + "Tìm việc". Submitting writes both to the URL; the page reads them back from there. */
export function SearchBar({ initialQ, initialLoc, onSearch }: { initialQ?: string; initialLoc?: string; onSearch: (q: string, loc: string) => void }) {
  const [q, setQ] = useState(initialQ || "");
  const [loc, setLoc] = useState(initialLoc || "");

  useEffect(() => setQ(initialQ || ""), [initialQ]);
  useEffect(() => setLoc(initialLoc || ""), [initialLoc]);

  return (
    <form
      className="jp-search"
      role="search"
      aria-label="Tìm việc làm"
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q.trim(), loc.trim());
      }}
    >
      <label className="jp-search-field">
        <span className="jp-sr">Từ khóa</span>
        <Icon name="search" />
        <input
          type="search"
          placeholder="Vị trí, kỹ năng, công ty…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      <label className="jp-search-field jp-search-field--loc">
        <span className="jp-sr">Địa điểm</span>
        <Icon name="pin" />
        <input
          placeholder="Tất cả địa điểm"
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          list="jp-location-suggestions"
          autoComplete="off"
        />
        <datalist id="jp-location-suggestions">
          {LOCATION_SUGGESTIONS.map((place) => <option key={place} value={place} />)}
        </datalist>
      </label>
      <button className="jp-btn jp-btn--primary jp-btn--lg jp-search-go" type="submit">Tìm việc</button>
    </form>
  );
}
