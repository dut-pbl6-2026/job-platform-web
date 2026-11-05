import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AdminShell } from "../components/AdminShell";
import { Pagination } from "../components/Pagination";
import { fetchAdminUsers, setAdminUserActive } from "../lib/adminApi";
import { apiErrorMessage } from "../lib/http";
import type { AdminUser, Paginated } from "../types/admin";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 8;

export default function AdminUsersPage() {
  useDocumentTitle("Quản trị: Người dùng");
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const role = sp.get("role") || "";
  const status = sp.get("status") || "";
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const [draftQ, setDraftQ] = useState(q);
  const [data, setData] = useState<Paginated<AdminUser> | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => { setDraftQ(q); }, [q]);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setErr(null);
    fetchAdminUsers({ q, role, status, page, size: PAGE_SIZE })
      .then((d) => { if (alive) setData(d); })
      .catch((e) => { if (alive) setErr(apiErrorMessage(e, "Không tải được người dùng")); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [q, role, status, page]);

  function patchQuery(next: Record<string, string>) {
    const params = new URLSearchParams(sp);
    for (const [key, value] of Object.entries(next)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    if (!("page" in next)) params.delete("page");
    setSp(params);
  }

  async function toggleActive(user: AdminUser) {
    const isActive = !user.isActive;
    setBusyId(user.id);
    setErr(null);
    try {
      await setAdminUserActive(user.id, isActive);
      setData((prev) => prev ? {
        ...prev,
        items: prev.items.map((u) => u.id === user.id ? { ...u, isActive } : u),
      } : prev);
    } catch (e: unknown) {
      setErr(apiErrorMessage(e, "Không cập nhật được tài khoản"));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Người dùng" lead="Tìm, lọc, khóa hoặc mở khóa tài khoản.">
      <form className="admin-filters" onSubmit={(e) => { e.preventDefault(); patchQuery({ q: draftQ.trim() }); }}>
        <input className="input" placeholder="Tên hoặc email" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} />
        <select className="input" value={role} onChange={(e) => patchQuery({ role: e.target.value })}>
          <option value="">Mọi vai trò</option>
          <option value="User">User</option>
          <option value="Recruiter">Recruiter</option>
          <option value="Admin">Admin</option>
        </select>
        <select className="input" value={status} onChange={(e) => patchQuery({ status: e.target.value })}>
          <option value="">Mọi trạng thái</option>
          <option value="active">Đang hoạt động</option>
          <option value="inactive">Đã khóa</option>
        </select>
        <button className="btn btn-primary" type="submit">Tìm</button>
      </form>
      {err && <div className="alert alert-error">{err}</div>}
      {loading && <div className="skeleton-detail" />}
      {!loading && data && data.items.length === 0 && <div className="empty"><h3>Không có người dùng</h3></div>}
      {!loading && data && data.items.length > 0 && (
        <div className="card admin-table-wrap">
          <table className="admin-table">
            <thead>
              <tr><th>Người dùng</th><th>Vai trò</th><th>Trạng thái</th><th>Ngày tạo</th></tr>
            </thead>
            <tbody>
              {data.items.map((user) => (
                <tr key={user.id}>
                  <td>
                    <strong>{user.fullName}</strong>
                    <div className="hint">{user.email}</div>
                  </td>
                  {/* auth-svc has no change-role endpoint yet: role is read-only here. */}
                  <td>{user.role}</td>
                  <td>
                    <button className="btn btn-ghost btn-sm" type="button" disabled={busyId === user.id || user.role === "Admin"} onClick={() => toggleActive(user)}>
                      {user.isActive ? "Đang hoạt động" : "Đã khóa"}
                    </button>
                  </td>
                  <td className="hint">{new Date(user.createdAt).toLocaleDateString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <Pagination page={data.page} totalPages={data.totalPages} onPage={(p) => patchQuery({ page: p ? String(p) : "" })} />
        </div>
      )}
    </AdminShell>
  );
}
