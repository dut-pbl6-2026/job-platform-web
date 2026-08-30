export function Pagination({ page, totalPages, onPage }: { page: number; totalPages: number; onPage: (p: number) => void }) {
  if (totalPages <= 1) return null;
  const pages = Array.from({ length: totalPages }, (_, i) => i);
  const windowPages = pages.slice(Math.max(0, page - 2), Math.min(totalPages, page + 3));
  const showTail = totalPages > 5 && windowPages[windowPages.length - 1] < totalPages - 1;
  const showHead = windowPages[0] > 0;
  return (
    <div className="pagination">
      <button className="btn btn-ghost" disabled={page === 0} onClick={() => onPage(page - 1)}>‹ Trước</button>
      {showHead && (
        <>
          <button className="btn btn-ghost" onClick={() => onPage(0)}>1</button>
          <span className="hint">…</span>
        </>
      )}
      {windowPages.map((p) => (
        <button key={p} className={`btn ${p === page ? "btn-primary" : "btn-ghost"}`} onClick={() => onPage(p)}>{p + 1}</button>
      ))}
      {showTail && (
        <>
          <span className="hint">…</span>
          <button className={`btn ${page === totalPages - 1 ? "btn-primary" : "btn-ghost"}`} onClick={() => onPage(totalPages - 1)}>{totalPages}</button>
        </>
      )}
      <button className="btn btn-ghost" disabled={page >= totalPages - 1} onClick={() => onPage(page + 1)}>Sau ›</button>
    </div>
  );
}
