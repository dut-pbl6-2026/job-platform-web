import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Icon } from "./ui";
import { LOCATION_SUGGESTIONS } from "../lib/searchFilters";

/** Keyword + place + submit. Submitting writes both to the URL; the page reads them back from there. */
export function SearchBar({
  initialQ,
  initialLoc,
  onSearch,
}: {
  initialQ?: string;
  initialLoc?: string;
  onSearch: (q: string, loc: string) => void;
}) {
  const { t } = useTranslation();
  const [q, setQ] = useState(initialQ || "");
  const [loc, setLoc] = useState(initialLoc || "");

  useEffect(() => setQ(initialQ || ""), [initialQ]);
  useEffect(() => setLoc(initialLoc || ""), [initialLoc]);

  return (
    <form
      className="jp-search"
      role="search"
      aria-label={t("jobs.search.formLabel")}
      onSubmit={(e) => {
        e.preventDefault();
        onSearch(q.trim(), loc.trim());
      }}
    >
      <label className="jp-search-field">
        <span className="jp-sr">{t("jobs.search.keyword")}</span>
        <Icon name="search" />
        <input
          type="search"
          placeholder={t("jobs.search.keywordPlaceholder")}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoComplete="off"
          enterKeyHint="search"
        />
      </label>
      <label className="jp-search-field jp-search-field--loc">
        <span className="jp-sr">{t("jobs.search.place")}</span>
        <Icon name="pin" />
        <input
          placeholder={t("jobs.search.placePlaceholder")}
          value={loc}
          onChange={(e) => setLoc(e.target.value)}
          list="jp-location-suggestions"
          autoComplete="off"
        />
        <datalist id="jp-location-suggestions">
          {LOCATION_SUGGESTIONS.map((place) => (
            <option key={place} value={place} />
          ))}
        </datalist>
      </label>
      <button className="jp-btn jp-btn--primary jp-btn--lg jp-search-go" type="submit">
        {t("jobs.search.submit")}
      </button>
    </form>
  );
}
