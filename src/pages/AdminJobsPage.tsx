import { useCallback, useEffect, useState, type FormEvent, type ReactNode } from "react";
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
  Panel,
  Select,
  SkeletonRows,
  StatusMark,
  Textarea,
  type StatusTone,
} from "../components/ui";
import {
  ADMIN_JOB_STATUSES,
  createAdminJob,
  decideJob,
  fetchAdminJob,
  fetchAdminJobs,
  hardDeleteAdminJob,
  isAdminJobStatus,
  softDeleteAdminJob,
  updateAdminJob,
  type AdminJobInput,
} from "../lib/adminApi";
import { timeAgo } from "../lib/jobsApi";
import { apiErrorMessage, httpStatus, loadErrorMessage } from "../lib/http";
import { categoryLabel, jobStatusLabel } from "../lib/labels";
import { queryKeys } from "../lib/queryClient";
import type { PendingJob } from "../types/admin";
import { useDocumentTitle } from "../hooks/useDocumentTitle";

const PAGE_SIZE = 8;

const STATUS_TONE: Record<string, StatusTone> = {
  active: "success",
  pending: "warning",
  rejected: "danger",
  closed: "neutral",
  deleted: "neutral",
};

/** What is open under a row. One at a time, so a row never stacks a form on top of another. */
type Open = { id: string; kind: "read" | "edit" | "reject" | "delete" | "purge" };

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
  const [creating, setCreating] = useState(false);
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

  // Removing the last job of page N > 0 empties that page; step back to one that still has jobs.
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

  /**
   * After any change: the admin lists and counts, and the public board and job page, which would
   * otherwise keep showing a deleted or edited job from cache until it goes stale.
   */
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
      // Someone else removed or changed the job meanwhile: show why, and reload the list.
      // job-svc words 404/409 in English, so say it here instead of echoing it.
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

  function decide(job: PendingJob, approved: boolean) {
    // job-svc rejects without a reason (422); stop here instead of sending the request.
    if (!approved && !reason.trim()) {
      setReasonErr(t("admin.jobs.reasonRequired"));
      return;
    }
    setReasonErr(null);
    void run(
      job.id,
      () => decideJob(job.id, approved, approved ? undefined : reason.trim()),
      t("admin.jobs.decideFailed"),
    );
  }

  async function create(input: AdminJobInput) {
    await createAdminJob(input);
    setCreating(false);
    setActionErr(null);
    setDone(t("admin.jobs.created", { title: input.title }));
    await refresh();
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
    <AdminShell
      title={t("admin.jobs.title")}
      lead={t("admin.jobs.lead")}
      actions={
        !creating && (
          <Button
            icon="plus"
            onClick={() => {
              setCreating(true);
              setOpen(null);
              setDone(null);
              setActionErr(null);
            }}
          >
            {t("admin.jobs.create")}
          </Button>
        )
      }
    >
      {creating && (
        <Panel title={t("admin.jobs.createTitle")} className="jp-jobform-panel">
          <p className="jp-muted jp-jobform-note">{t("admin.jobs.createNote")}</p>
          <AdminJobForm
            idPrefix="new-job"
            submitLabel={t("admin.jobs.publish")}
            busyLabel={t("admin.jobs.publishing")}
            onSubmit={create}
            onCancel={() => setCreating(false)}
          />
        </Panel>
      )}

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
                const pending = job.status === "pending";
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
                        {pending && (
                          <>
                            <Button
                              loading={busy && kind !== "reject"}
                              disabled={busy}
                              aria-label={t("admin.jobs.approveLabel", { title: job.title })}
                              onClick={() => decide(job, true)}
                            >
                              {t("admin.jobs.approve")}
                            </Button>
                            <Button
                              variant="danger"
                              aria-expanded={kind === "reject"}
                              aria-label={t("admin.jobs.rejectLabel", { title: job.title })}
                              disabled={busy}
                              onClick={() => toggle(job.id, "reject")}
                            >
                              {t("admin.jobs.reject")}
                            </Button>
                          </>
                        )}
                        {!pending && !deleted && (
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
                              icon="trash"
                              aria-expanded={kind === "delete"}
                              aria-label={t("admin.jobs.deleteLabel", { title: job.title })}
                              onClick={() => toggle(job.id, "delete")}
                            >
                              {t("admin.jobs.delete")}
                            </Button>
                          </>
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

                    {kind === "read" && (
                      <JobDetail jobId={job.id}>
                        {pending && (
                          <div className="jp-form-actions jp-queue-more">
                            <Button variant="secondary" icon="pencil" onClick={() => toggle(job.id, "edit")}>
                              {t("admin.jobs.editJob")}
                            </Button>
                            <Button variant="danger" icon="trash" onClick={() => toggle(job.id, "delete")}>
                              {t("admin.jobs.deleteJob")}
                            </Button>
                          </div>
                        )}
                      </JobDetail>
                    )}

                    {kind === "edit" && (
                      <EditJob job={job} onSave={(input) => save(job.id, input)} onCancel={() => setOpen(null)} />
                    )}

                    {kind === "reject" && (
                      <form
                        className="jp-queue-reject"
                        noValidate
                        onSubmit={(e) => {
                          e.preventDefault();
                          decide(job, false);
                        }}
                      >
                        <Field
                          id={`reason-${job.id}`}
                          label={t("admin.jobs.rejectReason")}
                          required
                          hint={t("admin.jobs.rejectHint")}
                          error={reasonErr}
                        >
                          <Textarea
                            rows={3}
                            maxLength={500}
                            value={reason}
                            placeholder={t("admin.jobs.rejectPlaceholder")}
                            onChange={(e) => setReason(e.target.value)}
                          />
                        </Field>
                        <div className="jp-form-actions">
                          <Button variant="secondary" onClick={() => setOpen(null)} disabled={busy}>
                            {t("admin.form.cancel")}
                          </Button>
                          <Button type="submit" variant="danger" loading={busy}>
                            {busy ? t("admin.jobs.rejectSubmitting") : t("admin.jobs.rejectConfirm")}
                          </Button>
                        </div>
                      </form>
                    )}

                    {kind === "delete" && (
                      <ConfirmBlock
                        label={t("admin.jobs.deleteConfirmLabel", { title: job.title })}
                        title={t("admin.jobs.deleteTitle")}
                        text={t("admin.jobs.deleteText")}
                        confirm={busy ? t("admin.jobs.deleting") : t("admin.jobs.deleteConfirm")}
                        busy={busy}
                        onConfirm={() =>
                          void run(
                            job.id,
                            async () => {
                              await softDeleteAdminJob(job.id);
                              return t("admin.jobs.deleted", { title: job.title });
                            },
                            t("admin.jobs.deleteFailed"),
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

function JobDetail({ jobId, children }: { jobId: string; children?: ReactNode }) {
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
          {job.status === "rejected" && job.rejectionReason?.trim() && (
            <Alert tone="warning" title={t("admin.jobs.rejectReason")}>
              {job.rejectionReason}
            </Alert>
          )}
          <FactStrip job={job} />
          <JobText title={t("jobs.detail.sectionDescription")} text={job.description} />
          <JobText title={t("jobs.detail.sectionRequirements")} text={job.requirements} />
          <JobText title={t("jobs.detail.sectionBenefits")} text={job.benefits} />
          {children}
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
  onConfirm,
  onCancel,
}: {
  label: string;
  title: string;
  text: string;
  confirm: string;
  busy: boolean;
  strong?: boolean;
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
        <Button variant="danger" loading={busy} onClick={onConfirm}>
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
