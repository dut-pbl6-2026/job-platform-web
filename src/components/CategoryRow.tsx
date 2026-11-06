import type { Category, SearchFacets } from "../types/job";
import { JOB_CATEGORIES } from "../lib/labels";
import { Button, FilterChip } from "./ui";

type Props = {
  /** GET /api/categories: search-svc filters by the category id, the label comes from labels.ts. */
  categories: Category[];
  selectedId?: string;
  facets?: SearchFacets;
  loadFailed: boolean;
  retrying: boolean;
  onRetry: () => void;
  onSelect: (id: string | undefined) => void;
};

/**
 * The 9 backend categories, one Vietnamese label each. Replaces the home showcase and the hero
 * category list. Counts only show when search-svc sends category facets (it has none yet), never
 * counted from one page of results.
 */
export function CategoryRow({ categories, selectedId, facets, loadFailed, retrying, onRetry, onSelect }: Props) {
  const idOf = (name: string) => categories.find((c) => c.name.toLowerCase() === name.toLowerCase())?.id;
  const countOf = (name: string) => facets?.category?.find((b) => b.value.toLowerCase() === name.toLowerCase())?.count;

  return (
    <div className="jp-cats">
      <h2 className="jp-sr">Ngành nghề</h2>
      <ul className="jp-cats-list">
        {JOB_CATEGORIES.map((cat) => {
          const id = idOf(cat.name);
          return (
            <li key={cat.name}>
              <FilterChip
                pressed={!!id && selectedId === id}
                disabled={!id}
                count={countOf(cat.name)}
                onClick={() => onSelect(selectedId === id ? undefined : id)}
              >
                {cat.label}
              </FilterChip>
            </li>
          );
        })}
      </ul>
      {loadFailed && (
        <p className="jp-cats-error" role="alert">
          Chưa tải được danh mục ngành nghề nên chưa lọc theo ngành được.
          <Button variant="ghost" size="sm" loading={retrying} onClick={onRetry}>
            {retrying ? "Đang thử lại…" : "Thử lại"}
          </Button>
        </p>
      )}
    </div>
  );
}
