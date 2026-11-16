import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AdminShell } from "../components/AdminShell";
import { AdminJobForm } from "../components/AdminJobForm";
import {
  Alert,
  Button,
  EmptyState,
  FactStrip,
  Field,
  Input,
  Pagination,
  Select,
  SkeletonRows,
  StatusMark,
  Textarea,
  type StatusTone,
} from "../components/ui";
import {
  ADMIN_JOB_STATUSES,
  fetchAdminJob,
  fetchAdminJobs,
  hardDeleteAdminJob,
  isAdminJobStatus,
  restoreAdminJob,
  takedownAdminJob,
  updateAdminJob,
  type AdminJobInput,
} from "../lib/adminApi";
import { timeAgo } from "../lib/jobsApi";
import { formatDate } from "../lib/dates";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import { categoryLabel, jobStatusLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import type { PendingJob } from "../types/admin";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 8;
const REASON_MAX = 500;

const STATUS_TONE: Record<string, StatusTone> = {
  active: "success",
  pending: "warning",
  rejected: "danger",
  closed: "neutral",
  deleted: "neutral",
};

/** What is open under a row. One at a time, so a row never stacks a form on top of another. */
type Open = { id: string; kind: "read" | "edit" | "takedown" | "restore" | "purge" };

/**
 * Job moderation. Jobs publish instantly, so there is no approve/reject step and no admin create form.
 * The admin can read and edit any job, take a job off the public board with a required reason, restore
 * it, and permanently delete a job that is already soft-deleted.
 */
export default function AdminJobsPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("admin.documentTitles.jobs"));
  const queryClient = useQueryClient();
  const [sp, setSp] = useSearchParams();
  const q = sp.get("q") || "";
  const rawStatus = sp.get("status") || "";
  const status = isAdminJobStatus(rawStatus) ? rawStatus : "";
  const page = Math.max(0, Number(sp.get("page")) || 0);
  const [draftQ, setDraftQ] = useState(q);
  const [open, setOpen] = useState<Open | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const [reasonErr, setReasonErr] = useState<string | null>(null);
  const [actionErr, setActionErr] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    setDraftQ(q);
  }, [q]);

  const query = useQuery({
    queryKey: queryKeys.adminJobs({ q, status, page }),
    queryFn: () => fetchAdminJobs({ q, status, page, size: PAGE_SIZE }),
    staleTime: 0,
  });
  const data = query.data;
  const filtered = !!(q || status);

  const patchQuery = useCallback(
    (next: Record<string, string>) => {
      const params = new URLSearchParams(sp);
      for (const [k, value] of Object.entries(next)) {
        if (value) params.set(k, value);
        else params.delete(k);
      }
      if (!("page" in next)) params.delete("page");
      setSp(params);
      setOpen(null);
    },
    [sp, setSp],
  );

  useEffect(() => {
    if (data && data.items.length === 0 && page > 0) patchQuery({ page: page > 1 ? String(page - 1) : "" });
  }, [data, page, patchQuery]);

  function search(e: FormEvent) {
    e.preventDefault();
    patchQuery({ q: draftQ.trim() });
  }

  function toggle(id: string, kind: Open["kind"]) {
    setOpen((cur) => (cur?.id === id && cur.kind === kind ? null : { id, kind }));
    setReason("");
    setReasonErr(null);
    setActionErr(null);
    setDone(null);
  }

  async function refresh(jobId?: string) {
    if (jobId) {
      queryClient.removeQueries({ queryKey: queryKeys.job(jobId) });
      queryClient.removeQueries({ queryKey: queryKeys.adminJob(jobId) });
    }
    void queryClient.invalidateQueries({ queryKey: queryKeys.allJobs });
    void queryClient.invalidateQueries({ queryKey: queryKeys.adminStats });
    await queryClient.invalidateQueries({ queryKey: queryKeys.allAdminJobs });
  }

  async function run(jobId: string, action: () => Promise<string>, fallback: string) {
    setBusyId(jobId);
    setActionErr(null);
    setDone(null);
    try {
      const message = await action();
      setOpen(null);
      setReason("");
      setDone(message);
      await refresh(jobId);
    } catch (e: unknown) {
      const status = httpStatus(e);
      if (status === 404 || status === 409) void refresh(jobId);
      setActionErr(
        status === 404
          ? t("admin.jobs.gone")
          : status === 409
            ? t("admin.jobs.conflict")
            : apiErrorMessage(e, fallback),
      );
    } finally {
      setBusyId(null);
    }
  }

  function takedown(job: PendingJob) {
    // The backend requires a reason; stop here instead of sending a request it will reject.
    if (!reason.trim()) {
      setReasonErr(t("admin.jobs.takedownReasonRequired"));
      return;
    }
    setReasonErr(null);
    void run(
      job.id,
      async () => {
        await takedownAdminJob(job.id, reason);
        return t("admin.jobs.takenDown", { title: job.title });
      },
      t("admin.jobs.takedownFailed"),
    );
  }

  async function save(jobId: string, input: AdminJobInput) {
    await updateAdminJob(jobId, input);
    setOpen(null);
    setActionErr(null);
    setDone(t("admin.jobs.saved", { title: input.title }));
    await refresh(jobId);
  }

  const showing = status ? jobStatusLabel(status).toLowerCase() : null;

  return (
    <AdminShell title={t("admin.jobs.title")} lead={t("admin.jobs.lead")}>
      <form
        className="jp-user-filters jp-job-filters"
        onSubmit={search}
        role="search"
        aria-label={t("admin.jobs.searchLabel")}
      >
        <Field id="job-q" label={t("admin.jobs.titleLabel")} className="jp-user-filters-q">
          <Input type="search" value={draftQ} onChange={(e) => setDraftQ(e.target.value)} autoComplete="off" />
        </Field>
        <Field id="job-status" label={t("admin.jobs.statusLabel")}>
          <Select value={status} onChange={(e) => patchQuery({ status: e.target.value })}>
            <option value="">{t("admin.jobs.allStatuses")}</option>
            {ADMIN_JOB_STATUSES.map((s) => (
              <option key={s} value={s}>
                {jobStatusLabel(s)}
              </option>
            ))}
          </Select>
        </Field>
        <Button type="submit" className="jp-user-filters-go">
          {t("admin.jobs.search")}
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
          {loadErrorMessage(query.error, t("admin.jobs.loadWhat"))}
        </Alert>
      )}

      {query.isPending && <SkeletonRows rows={4} label={t("admin.jobs.loading")} />}

      {data && data.items.length === 0 && page === 0 && (
        <EmptyState
          title={
            q
              ? t("admin.jobs.emptySearch")
              : showing
                ? t("admin.jobs.emptyStatus", { status: showing })
                : t("admin.jobs.emptyNone")
          }
          action={
            filtered ? (
              <Button variant="secondary" onClick={() => patchQuery({ q: "", status: "" })}>
                {t("jobs.clearFilters")}
              </Button>
            ) : undefined
          }
        />
      )}

      {data && data.items.length > 0 && (
        <>
          <p className="jp-count" aria-live="polite">
            {t("admin.jobs.count", { total: data.total.toLocaleString("vi-VN"), status: showing ? ` ${showing}` : "" })}
          </p>
          <div className="jp-queue jp-queue--manage">
            <div className="jp-queue-head" aria-hidden="true">
              <span>{t("admin.jobs.colJob")}</span>
              <span>{t("admin.jobs.colStatus")}</span>
              <span>{t("admin.jobs.colCategory")}</span>
              <span>{t("admin.jobs.colPosted")}</span>
              <span className="jp-queue-head-actions">{t("admin.jobs.colActions")}</span>
            </div>
            <ol className="jp-queue-rows" aria-label={t("admin.jobs.listLabel")}>
              {data.items.map((job) => {
                const kind = open?.id === job.id ? open.kind : null;
                const busy = busyId === job.id;
                const deleted = job.status === "deleted";
                const takenDown = deleted && !!job.moderationReason;
                return (
                  <li key={job.id} className="jp-queue-item">
                    <div className="jp-queue-row">
                      <div className="jp-row-main">
                        <h3 className="jp-row-title">{job.title}</h3>
                        <p className="jp-row-company" title={job.company.name}>
                          {job.company.name || t("common.notProvided")}
                        </p>
                        {job.recruiterName && (
                          <p className="jp-queue-by">{t("admin.jobs.postedBy", { name: job.recruiterName })}</p>
                        )}
                        {job.moderationReason && (
                          <p className="jp-queue-moderation">
                            {t("admin.jobs.moderation", {
                              reason: job.moderationReason,
                              date: job.moderatedAt ? formatDate(job.moderatedAt) : t("common.notProvided"),
                            })}
                          </p>
                        )}
                      </div>
                      <span className="jp-cell">
                        <span className="jp-sr">{t("admin.jobs.srStatus")}</span>
                        <StatusMark tone={STATUS_TONE[job.status] ?? "neutral"}>
                          {jobStatusLabel(job.status)}
                        </StatusMark>
                      </span>
                      <span className="jp-cell">
                        <span className="jp-sr">{t("admin.jobs.srCategory")}</span>
                        {categoryLabel(job.category.name)}
                      </span>
                      <span className="jp-cell jp-cell--date">
                        <span className="jp-sr">{t("admin.jobs.srPosted")}</span>
                        {timeAgo(job.createdAt) || t("common.notProvided")}
                      </span>
                      <div className="jp-queue-actions">
                        <Button
                          variant="secondary"
                          aria-expanded={kind === "read"}
                          onClick={() => toggle(job.id, "read")}
                        >
                          {kind === "read" ? t("admin.jobs.hideContent") : t("admin.jobs.showContent")}
                        </Button>
                        {!deleted && (
                          <>
                            <Button
                              variant="secondary"
                              icon="pencil"
                              aria-expanded={kind === "edit"}
                              aria-label={t("admin.jobs.editLabel", { title: job.title })}
                              onClick={() => toggle(job.id, "edit")}
                            >
                              {t("admin.jobs.edit")}
                            </Button>
                            <Button
                              variant="danger"
                              aria-expanded={kind === "takedown"}
                              aria-label={t("admin.jobs.takedownLabel", { title: job.title })}
                              disabled={busy}
                              onClick={() => toggle(job.id, "takedown")}
                            >
                              {t("admin.jobs.takedown")}
                            </Button>
                          </>
                        )}
                        {takenDown && (
                          <Button
                            variant="secondary"
                            aria-expanded={kind === "restore"}
                            aria-label={t("admin.jobs.restoreLabel", { title: job.title })}
                            disabled={busy}
                            onClick={() => toggle(job.id, "restore")}
                          >
                            {t("admin.jobs.restore")}
                          </Button>
                        )}
                        {deleted && (
                          <Button
                            variant="danger"
                            icon="trash"
                            aria-expanded={kind === "purge"}
                            aria-label={t("admin.jobs.purgeLabel", { title: job.title })}
                            onClick={() => toggle(job.id, "purge")}
                          >
                            {t("admin.jobs.purge")}
                          </Button>
                        )}
                      </div>
                    </div>

                    {kind === "read" && <JobDetail jobId={job.id} />}

                    {kind === "edit" && (
                      <EditJob job={job} onSave={(input) => save(job.id, input)} onCancel={() => setOpen(null)} />
                    )}

                    {kind === "takedown" && (
                      <form
                        className="jp-queue-reject"
                        noValidate
                        aria-label={t("admin.jobs.takedownGroup", { title: job.title })}
                        onSubmit={(e) => {
                          e.preventDefault();
                          takedown(job);
                        }}
                      >
                        <div>
                          <p className="jp-queue-confirm-title">{t("admin.jobs.takedownTitle")}</p>
                          <p className="jp-queue-confirm-text">{t("admin.jobs.takedownText")}</p>
                        </div>
                        <Field
                          id={`takedown-${job.id}`}
                          label={t("admin.jobs.takedownReason")}
                          required
                          hint={t("admin.jobs.takedownHint", { max: REASON_MAX })}
                          error={reasonErr}
                        >
                          <Textarea
                            rows={3}
                            maxLength={REASON_MAX}
                            value={reason}
                            placeholder={t("admin.jobs.takedownPlaceholder")}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </Field>
                        <div className="jp-form-actions">
                          <Button variant="secondary" onClick={() => setOpen(null)} disabled={busy}>
                            {t("admin.form.cancel")}
                          </Button>
                          <Button type="submit" variant="danger" loading={busy}>
                            {busy ? t("admin.jobs.takedownSubmitting") : t("admin.jobs.takedownConfirm")}
                          </Button>
                        </div>
                      </form>
                    )}

                    {kind === "restore" && (
                      <ConfirmBlock
                        tone="primary"
                        label={t("admin.jobs.restoreConfirmLabel", { title: job.title })}
                        title={t("admin.jobs.restoreTitle")}
                        text={t("admin.jobs.restoreText")}
                        confirm={busy ? t("admin.jobs.restoring") : t("admin.jobs.restoreConfirm")}
                        busy={busy}
                        onConfirm={() =>
                          void run(
                            job.id,
                            async () => {
                              await restoreAdminJob(job.id);
                              return t("admin.jobs.restored", { title: job.title });
                            },
                            t("admin.jobs.restoreFailed"),
                          )
                        }
                        onCancel={() => setOpen(null)}
                      />
                    )}

                    {kind === "purge" && (
                      <ConfirmBlock
                        strong
                        label={t("admin.jobs.purgeConfirmLabel", { title: job.title })}
                        title={t("admin.jobs.purgeTitle")}
                        text={t("admin.jobs.purgeText")}
                        confirm={busy ? t("admin.jobs.deleting") : t("admin.jobs.purgeConfirm")}
                        busy={busy}
                        onConfirm={() =>
                          void run(
                            job.id,
                            async () => {
                              await hardDeleteAdminJob(job.id);
                              return t("admin.jobs.purged", { title: job.title });
                            },
                            t("admin.jobs.deleteFailed"),
                          )
                        }
                        onCancel={() => setOpen(null)}
                      />
                    )}
                  </li>
                );
              })}
            </ol>
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

/** Full content of a job in any status: the list has no description, and /jobs/:id hides non-active jobs. */
function useAdminJob(jobId: string) {
  return useQuery({
    queryKey: queryKeys.adminJob(jobId),
    queryFn: async () => {
      const job = await fetchAdminJob(jobId);
      if (!job) throw Object.assign(new Error("Job no longer exists."), { status: 404 });
      return job;
    },
    staleTime: 0,
    retry: false,
  });
}

function JobDetail({ jobId }: { jobId: string }) {
  const { t } = useTranslation();
  const detail = useAdminJob(jobId);
  const job = detail.data;
  return (
    <div className="jp-queue-detail">
      {detail.isPending && (
        <p className="jp-muted" role="status">
          {t("admin.jobs.contentLoading")}
        </p>
      )}
      {detail.isError && <Alert tone="error">{loadErrorMessage(detail.error, t("admin.jobs.contentWhat"))}</Alert>}
      {job && (
        <>
          {job.moderationReason && (
            <Alert tone="warning" title={t("admin.jobs.moderationTitle")}>
              {t("admin.jobs.moderationDetail", {
                reason: job.moderationReason,
                date: job.moderatedAt ? formatDate(job.moderatedAt) : t("common.notProvided"),
              })}
            </Alert>
          )}
          <FactStrip job={job} />
          <JobText title={t("jobs.detail.sectionDescription")} text={job.description} />
          <JobText title={t("jobs.detail.sectionRequirements")} text={job.requirements} />
          <JobText title={t("jobs.detail.sectionBenefits")} text={job.benefits} />
        </>
      )}
    </div>
  );
}

function EditJob({
  job,
  onSave,
  onCancel,
}: {
  job: PendingJob;
  onSave: (input: AdminJobInput) => Promise<void>;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  const detail = useAdminJob(job.id);
  return (
    <div className="jp-queue-detail jp-queue-edit">
      <h4 className="jp-h3">{t("admin.jobs.editTitle")}</h4>
      {detail.isPending && (
        <p className="jp-muted" role="status">
          {t("admin.jobs.contentLoadingEdit")}
        </p>
      )}
      {detail.isError && <Alert tone="error">{loadErrorMessage(detail.error, t("admin.jobs.contentWhat"))}</Alert>}
      {detail.data && (
        <AdminJobForm
          idPrefix={`edit-${job.id}`}
          initial={detail.data}
          submitLabel={t("admin.jobs.saveChanges")}
          busyLabel={t("admin.jobs.savingChanges")}
          onSubmit={onSave}
          onCancel={onCancel}
        />
      )}
    </div>
  );
}

function ConfirmBlock({
  label,
  title,
  text,
  confirm,
  busy,
  strong,
  tone = "danger",
  onConfirm,
  onCancel,
}: {
  label: string;
  title: string;
  text: string;
  confirm: string;
  busy: boolean;
  strong?: boolean;
  tone?: "danger" | "primary";
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div
      className={strong ? "jp-queue-confirm jp-queue-confirm--strong" : "jp-queue-confirm"}
      role="group"
      aria-label={label}
    >
      <div>
        <p className="jp-queue-confirm-title">{title}</p>
        <p className="jp-queue-confirm-text">{text}</p>
      </div>
      <div className="jp-form-actions">
        <Button variant="secondary" disabled={busy} onClick={onCancel}>
          {t("admin.form.cancel")}
        </Button>
        <Button variant={tone === "danger" ? "danger" : "primary"} loading={busy} onClick={onConfirm}>
          {confirm}
        </Button>
      </div>
    </div>
  );
}

function JobText({ title, text }: { title: string; text: string | null | undefined }) {
  const { t } = useTranslation();
  return (
    <section className="jp-detail-section">
      <h4 className="jp-h3">{title}</h4>
      {text?.trim() ? <p className="jp-prose">{text}</p> : <p className="jp-muted">{t("common.notProvided")}</p>}
    </section>
  );
}
