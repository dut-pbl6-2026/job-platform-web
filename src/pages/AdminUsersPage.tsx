import { useEffect, useState, type FormEvent } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "../components/AdminShell";
import {
  Alert,
  Button,
  EmptyState,
  Field,
  Input,
  Pagination,
  Select,
  SkeletonRows,
  StatusMark,
} from "../components/ui";
import { fetchAdminUsers, setAdminUserActive } from "../lib/adminApi";
import { formatDate } from "../lib/dates";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { roleLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import type { AdminUser, Paginated } from "../types/admin";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 8;

export default function AdminUsersPage() {
  useDocumentTitle("Quản trị: Người dùng");
  const queryClient = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const role = sp.get("role") || "";
  const status = sp.get("status") || "";
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const [draftQ, setDraftQ] = useState(q);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => { setDraftQ(q); }, [q]);

  const key = queryKeys.adminUsers({ q, role, status, page });
  const query = useQuery({
    queryKey: key,
    queryFn: () => fetchAdminUsers({ q, role, status, page, size: PAGE_SIZE }),
    staleTime: 0,
  });
  const data = query.data;
  const filtered = !!(q || role || status);

  function patchQuery(next: Record<string, string>) {
    const params = new URLSearchParams(sp);
    for (const [k, value] of Object.entries(next)) {
      if (value) params.set(k, value); else params.delete(k);
    }
    if (!("page" in next)) params.delete("page");
    setSp(params);
  }

  function search(e: FormEvent) {
    e.preventDefault();
    patchQuery({ q: draftQ.trim() });
  }

  async function toggleActive(user: AdminUser) {
    const isActive = !user.isActive;
    setBusyId(user.id);
    setActionErr(null);
    setDone(null);
    try {
      await setAdminUserActive(user.id, isActive);
      queryClient.setQueryData<Paginated<AdminUser>>(key, (prev) =>
        prev ? { ...prev, items: prev.items.map((u) => (u.id === user.id ? { ...u, isActive } : u)) } : prev,
      );
      setConfirmId(null);
      setDone(`Đã ${isActive ? "kích hoạt" : "vô hiệu hóa"} tài khoản ${user.email}.`);
    } catch (e: unknown) {
      setActionErr(apiErrorMessage(e, "Chưa cập nhật được tài khoản. Vui lòng thử lại."));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title="Người dùng" lead="Tìm, lọc, kích hoạt hoặc vô hiệu hóa tài khoản.">
      <form className="jp-user-filters" onSubmit={search} role="search" aria-label="Tìm người dùng">
        <Field id="user-q" label="Tên hoặc email" className="jp-user-filters-q">
          <Input type="search" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} autoComplete="off" />
        </Field>
        <Field id="user-role" label="Vai trò">
          <Select value={role} onChange={(e) => patchQuery({ role: e.target.value })}>
            <option value="">Mọi vai trò</option>
            <option value="User">{roleLabel("User")}</option>
            <option value="Recruiter">{roleLabel("Recruiter")}</option>
            <option value="Admin">{roleLabel("Admin")}</option>
          </Select>
        </Field>
        <Field id="user-status" label="Trạng thái">
          <Select value={status} onChange={(e) => patchQuery({ status: e.target.value })}>
            <option value="">Mọi trạng thái</option>
            <option value="active">Đang hoạt động</option>
            <option value="inactive">Đã vô hiệu hóa</option>
          </Select>
        </Field>
        <Button type="submit" className="jp-user-filters-go">Tìm</Button>
      </form>

      {actionErr && <Alert tone="error">{actionErr}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}

      {query.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
              {query.isFetching ? "Đang thử lại…" : "Thử lại"}
            </Button>
          }
        >
          {loadErrorMessage(query.error, "danh sách người dùng")}
        </Alert>
      )}

      {query.isPending && <SkeletonRows rows={5} label="Đang tải người dùng" />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={filtered ? "Không có người dùng nào khớp bộ lọc" : "Chưa có người dùng"}
          action={filtered ? <Button variant="secondary" onClick={() => setSp(new URLSearchParams())}>Xóa bộ lọc</Button> : undefined}
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="jp-count" aria-live="polite">{data.total.toLocaleString("vi-VN")} người dùng</p>
          <div className="jp-table-wrap">
            <table className="jp-table jp-table--users">
              <thead>
                <tr>
                  <th scope="col">Người dùng</th>
                  <th scope="col">Vai trò</th>
                  <th scope="col">Trạng thái</th>
                  <th scope="col">Ngày tạo</th>
                  <th scope="col" className="jp-table-actions">Thao tác</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const confirming = confirmId === user.id;
                  const busy = busyId === user.id;
                  const verb = user.isActive ? "Vô hiệu hóa" : "Kích hoạt";
                  return (
                    <tr key={user.id}>
                      <th scope="row" className="jp-user-name">
                        <strong>{user.fullName}</strong>
                        <span>{user.email}</span>
                      </th>
                      {/* auth-svc has no change-role endpoint yet: role is read-only here. */}
                      <td>
                        <span className="jp-sr">Vai trò: </span>
                        {roleLabel(user.role)}
                      </td>
                      <td>
                        <span className="jp-sr">Trạng thái: </span>
                        <StatusMark tone={user.isActive ? "success" : "neutral"}>
                          {user.isActive ? "Đang hoạt động" : "Đã vô hiệu hóa"}
                        </StatusMark>
                      </td>
                      <td className="jp-muted">
                        <span className="jp-sr">Ngày tạo: </span>
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="jp-table-actions">
                        {user.role === "Admin" ? (
                          <span className="jp-muted">Không áp dụng cho quản trị viên</span>
                        ) : confirming ? (
                          <div className="jp-confirm" role="group" aria-label={`Xác nhận ${verb.toLowerCase()} ${user.email}`}>
                            <span className="jp-confirm-text">{verb} tài khoản này?</span>
                            <Button
                              variant={user.isActive ? "danger" : "primary"}
                              loading={busy}
                              onClick={() => void toggleActive(user)}
                            >
                              {busy ? "Đang lưu…" : "Xác nhận"}
                            </Button>
                            <Button variant="secondary" disabled={busy} onClick={() => setConfirmId(null)}>Hủy</Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            aria-label={`${verb} ${user.email}`}
                            onClick={() => { setConfirmId(user.id); setDone(null); setActionErr(null); }}
                          >
                            {verb}
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <Pagination page={page} totalPages={data.totalPages} onPage={(p) => patchQuery({ page: p ? String(p) : "" })} />
        </>
      )}
    </AdminShell>
  );
}
