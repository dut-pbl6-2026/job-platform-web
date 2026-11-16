import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { RecruiterShell } from "../components/RecruiterShell";
import { Alert, Button, EmptyState, Field, Icon, Input, Modal, SkeletonRows, Textarea } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import {
  createEmailTemplate,
  deleteEmailTemplate,
  fetchEmailTemplates,
  updateEmailTemplate,
  type EmailTemplate,
} from "../lib/engagementApi";
import { formatDate } from "../lib/dates";
import { apiErrorMessage, loadErrorMessage } from "../lib/http";
import { showToast } from "../lib/toastBus";

const NAME_MAX = 120;
const SUBJECT_MAX = 200;
const BODY_MAX = 8000;

type Draft = { name: string; subject: string; body: string };
const EMPTY: Draft = { name: "", subject: "", body: "" };

/**
 * The recruiter's own email templates. A template is a starting point for the composer: the server
 * replaces {{candidate_name}}, {{job_title}} and {{recruiter_name}} when the message is sent.
 */
export default function RecruiterEmailTemplatesPage() {
  const { t } = useTranslation();
  useDocumentTitle(t("recruiter.documentTitles.templates"));
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<EmailTemplate | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const templates = useQuery({ queryKey: ["email-templates"], queryFn: fetchEmailTemplates, staleTime: 0 });
  const open = creating || editing !== null;

  useEffect(() => {
    if (creating) setDraft(EMPTY);
    else if (editing) setDraft({ name: editing.name, subject: editing.subject, body: editing.body });
    setFormError(null);
  }, [creating, editing]);

  function close() {
    setCreating(false);
    setEditing(null);
  }

  const save = useMutation({
    mutationFn: () => (editing ? updateEmailTemplate(editing.id, draft) : createEmailTemplate(draft)),
    onSuccess: () => {
      showToast({ title: t(editing ? "recruiter.templates.saved" : "recruiter.templates.created"), kind: "success" });
      void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
      close();
    },
    onError: (error: unknown) => setFormError(apiErrorMessage(error, t("recruiter.templates.saveFailed"))),
  });

  const remove = useMutation({
    mutationFn: (id: string) => deleteEmailTemplate(id),
    onSuccess: () => {
      showToast({ title: t("recruiter.templates.deleted"), kind: "success" });
      setDeleteId(null);
      void queryClient.invalidateQueries({ queryKey: ["email-templates"] });
    },
    onError: (error: unknown) =>
      showToast({ title: apiErrorMessage(error, t("recruiter.templates.deleteFailed")), kind: "error" }),
  });

  function submit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    if (!draft.name.trim() || !draft.subject.trim() || !draft.body.trim()) {
      setFormError(t("recruiter.templates.required"));
      return;
    }
    save.mutate();
  }

  return (
    <RecruiterShell
      title={t("recruiter.templates.title")}
      lead={t("recruiter.templates.lead")}
      actions={
        <Button icon="plus" onClick={() => setCreating(true)}>
          {t("recruiter.templates.new")}
        </Button>
      }
    >
      <div className="jp-template-note">
        <Icon name="info" size={18} />
        <p>
          {t("recruiter.templates.placeholderNote")} <code className="jp-code">{"{{candidate_name}}"}</code>{" "}
          <code className="jp-code">{"{{job_title}}"}</code> <code className="jp-code">{"{{recruiter_name}}"}</code>
        </p>
      </div>

      {templates.isPending && <SkeletonRows rows={3} label={t("recruiter.templates.loading")} />}
      {templates.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={templates.isFetching} onClick={() => void templates.refetch()}>
              {t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(templates.error, t("recruiter.templates.loadWhat"))}
        </Alert>
      )}

      {templates.data && templates.data.length === 0 && (
        <EmptyState
          title={t("recruiter.templates.empty")}
          action={
            <Button icon="plus" onClick={() => setCreating(true)}>
              {t("recruiter.templates.new")}
            </Button>
          }
        >
          {t("recruiter.templates.emptyText")}
        </EmptyState>
      )}

      {templates.data && templates.data.length > 0 && (
        <ul className="jp-template-grid" aria-label={t("recruiter.templates.listLabel")}>
          {templates.data.map((template) => (
            <li className="jp-template-card" key={template.id}>
              <div className="jp-template-head">
                <span className="jp-template-icon" aria-hidden="true">
                  <Icon name="mail" size={18} />
                </span>
                <div>
                  <strong>{template.name}</strong>
                  <span>{t("recruiter.templates.updated", { date: formatDate(template.updatedAt) })}</span>
                </div>
              </div>
              <p className="jp-template-subject">{template.subject}</p>
              <p className="jp-template-body">{template.body}</p>
              <div className="jp-template-actions">
                <Button variant="secondary" size="sm" icon="pencil" onClick={() => setEditing(template)}>
                  {t("recruiter.templates.edit")}
                </Button>
                {deleteId === template.id ? (
                  <span className="jp-template-confirm">
                    <span>{t("recruiter.templates.confirmDelete")}</span>
                    <Button
                      variant="danger"
                      size="sm"
                      loading={remove.isPending}
                      onClick={() => remove.mutate(template.id)}
                    >
                      {t("recruiter.templates.delete")}
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)}>
                      {t("common.cancel")}
                    </Button>
                  </span>
                ) : (
                  <Button variant="ghost" size="sm" icon="trash" onClick={() => setDeleteId(template.id)}>
                    {t("recruiter.templates.delete")}
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <Modal
        open={open}
        title={t(editing ? "recruiter.templates.editTitle" : "recruiter.templates.newTitle")}
        lead={t("recruiter.templates.modalLead")}
        size="lg"
        onClose={close}
        footer={
          <>
            <Button variant="secondary" type="button" onClick={close} disabled={save.isPending}>
              {t("common.cancel")}
            </Button>
            <Button type="submit" form="template-form" loading={save.isPending}>
              {t("recruiter.templates.save")}
            </Button>
          </>
        }
      >
        <form id="template-form" className="jp-modal-form" onSubmit={submit} noValidate>
          {formError && <Alert tone="error">{formError}</Alert>}
          <Field id="template-name" label={t("recruiter.templates.name")} required>
            <Input
              id="template-name"
              value={draft.name}
              maxLength={NAME_MAX}
              placeholder={t("recruiter.templates.namePlaceholder")}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
          </Field>
          <Field id="template-subject" label={t("recruiter.templates.subject")} required>
            <Input
              id="template-subject"
              value={draft.subject}
              maxLength={SUBJECT_MAX}
              placeholder={t("recruiter.templates.subjectPlaceholder")}
              onChange={(event) => setDraft({ ...draft, subject: event.target.value })}
            />
          </Field>
          <Field
            id="template-body"
            label={t("recruiter.templates.body")}
            required
            hint={t("recruiter.templates.counter", {
              length: draft.body.length.toLocaleString("vi-VN"),
              max: BODY_MAX.toLocaleString("vi-VN"),
            })}
          >
            <Textarea
              id="template-body"
              rows={10}
              maxLength={BODY_MAX}
              value={draft.body}
              onChange={(event) => setDraft({ ...draft, body: event.target.value })}
            />
          </Field>
        </form>
      </Modal>
    </RecruiterShell>
  );
}
