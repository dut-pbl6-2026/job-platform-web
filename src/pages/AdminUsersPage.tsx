import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
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
  const { t } = useTranslation();
  useDocumentTitle(t("admin.documentTitles.users"));
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

  useEffect(() => {
    setDraftQ(q);
  }, [q]);

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
      if (value) params.set(k, value);
      else params.delete(k);
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
      setDone(
        isActive
          ? t("admin.users.doneActivated", { email: user.email })
          : t("admin.users.doneDeactivated", { email: user.email }),
      );
    } catch (e: unknown) {
      setActionErr(apiErrorMessage(e, t("admin.users.updateFailed")));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <AdminShell title={t("admin.users.title")} lead={t("admin.users.lead")}>
      <form className="jp-user-filters" onSubmit={search} role="search" aria-label={t("admin.users.searchLabel")}>
        <Field id="user-q" label={t("admin.users.nameOrEmail")} className="jp-user-filters-q">
          <Input type="search" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} autoComplete="off" />
        </Field>
        <Field id="user-role" label={t("admin.users.role")}>
          <Select value={role} onChange={(e) => patchQuery({ role: e.target.value })}>
            <option value="">{t("admin.users.allRoles")}</option>
            <option value="User">{roleLabel("User")}</option>
            <option value="Recruiter">{roleLabel("Recruiter")}</option>
            <option value="Admin">{roleLabel("Admin")}</option>
          </Select>
        </Field>
        <Field id="user-status" label={t("admin.users.status")}>
          <Select value={status} onChange={(e) => patchQuery({ status: e.target.value })}>
            <option value="">{t("admin.users.allStatuses")}</option>
            <option value="active">{t("admin.users.statusActive")}</option>
            <option value="inactive">{t("admin.users.statusInactive")}</option>
          </Select>
        </Field>
        <Button type="submit" className="jp-user-filters-go">
          {t("admin.users.search")}
        </Button>
      </form>

      {actionErr && <Alert tone="error">{actionErr}</Alert>}
      {done && <Alert tone="success">{done}</Alert>}

      {query.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={query.isFetching} onClick={() => void query.refetch()}>
              {query.isFetching ? t("jobs.retrying") : t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(query.error, t("admin.users.loadWhat"))}
        </Alert>
      )}

      {query.isPending && <SkeletonRows rows={5} label={t("admin.users.loading")} />}

      {data && data.items.length === 0 && (
        <EmptyState
          title={filtered ? t("admin.users.filteredEmpty") : t("admin.users.empty")}
          action={
            filtered ? (
              <Button variant="secondary" onClick={() => setSp(new URLSearchParams())}>
                {t("admin.users.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="jp-count" aria-live="polite">
            {t("admin.users.count", { total: data.total.toLocaleString("vi-VN") })}
          </p>
          <div className="jp-table-wrap">
            <table className="jp-table jp-table--users">
              <thead>
                <tr>
                  <th scope="col">{t("admin.users.colUser")}</th>
                  <th scope="col">{t("admin.users.colRole")}</th>
                  <th scope="col">{t("admin.users.colStatus")}</th>
                  <th scope="col">{t("admin.users.colCreated")}</th>
                  <th scope="col" className="jp-table-actions">
                    {t("admin.users.colActions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((user) => {
                  const confirming = confirmId === user.id;
                  const busy = busyId === user.id;
                  const verb = user.isActive ? t("admin.users.verbDeactivate") : t("admin.users.verbActivate");
                  return (
                    <tr key={user.id}>
                      <th scope="row" className="jp-user-name">
                        <strong>{user.fullName}</strong>
                        <span>{user.email}</span>
                      </th>
                      {/* auth-svc has no change-role endpoint yet: role is read-only here. */}
                      <td>
                        <span className="jp-sr">{t("admin.users.srRole")}</span>
                        {roleLabel(user.role)}
                      </td>
                      <td>
                        <span className="jp-sr">{t("admin.users.srStatus")}</span>
                        <StatusMark tone={user.isActive ? "success" : "neutral"}>
                          {user.isActive ? t("admin.users.statusActive") : t("admin.users.statusInactive")}
                        </StatusMark>
                      </td>
                      <td className="jp-muted">
                        <span className="jp-sr">{t("admin.users.srCreated")}</span>
                        {formatDate(user.createdAt)}
                      </td>
                      <td className="jp-table-actions">
                        {user.role === "Admin" ? (
                          <span className="jp-muted">{t("admin.users.adminNoAction")}</span>
                        ) : confirming ? (
                          <div
                            className="jp-confirm"
                            role="group"
                            aria-label={t("admin.users.confirmGroup", { verb: verb.toLowerCase(), email: user.email })}
                          >
                            <span className="jp-confirm-text">{t("admin.users.confirmQuestion", { verb })}</span>
                            <Button
                              variant={user.isActive ? "danger" : "primary"}
                              loading={busy}
                              onClick={() => void toggleActive(user)}
                            >
                              {busy ? t("admin.users.saving") : t("admin.users.confirm")}
                            </Button>
                            <Button variant="secondary" disabled={busy} onClick={() => setConfirmId(null)}>
                              {t("admin.users.cancel")}
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="secondary"
                            aria-label={t("admin.users.actionLabel", { verb, email: user.email })}
                            onClick={() => {
                              setConfirmId(user.id);
                              setDone(null);
                              setActionErr(null);
                            }}
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
          <Pagination
            page={page}
            totalPages={data.totalPages}
            onPage={(p) => patchQuery({ page: p ? String(p) : "" })}
          />
        </>
      )}
    </AdminShell>
  );
}
