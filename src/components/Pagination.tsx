export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i);
  return (
    <div className="pagination">
      <button className="btn btn-ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>‹ Trước</button>
      {pages.slice(Math.max(0, page - 2), Math.min(totalPages, page + 3)).map((p) => (
        <button key={p} className={`btn ${p === page ? "btn-primary" : "btn-ghost"}`} onClick={() => onPage(p)}>{p + 1}</button>
      ))}
      {totalPages > 6 && <span className="hint">… {totalPages}</span>}
      <button className="btn btn-ghost" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>Sau ›</button>
    </div>
  );
}
