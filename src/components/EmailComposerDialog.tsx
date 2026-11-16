import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Alert, Button, Field, Input, Modal, Textarea } from "../components/ui";
import { fetchEmailTemplates, sendApplicationEmail } from "../lib/engagementApi";
import { apiErrorMessage } from "../lib/http";
import type { Application } from "../types/application";

const SUBJECT_MAX = 200;
const BODY_MAX = 8000;
const PLACEHOLDERS = ["{{candidate_name}}", "{{job_title}}", "{{recruiter_name}}"];

/**
 * Composes one email to the applicant. A saved template fills the subject and body, placeholders are
 * resolved by the server, and the candidate's address is read-only (it comes from the application).
 */
export function EmailComposerDialog({
  open,
  application,
  onClose,
  onSent,
}: {
  open: boolean;
  application: Application | null;
  onClose: () => void;
  onSent: () => void;
}) {
  const { t } = useTranslation();
  const [templateId, setTemplateId] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const templates = useQuery({
    queryKey: ["email-templates"],
    queryFn: fetchEmailTemplates,
    enabled: open,
    staleTime: 60_000,
  });

  // biome-ignore lint/correctness/useExhaustiveDependencies: open and the application are the reset triggers.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setTemplateId("");
    setSubject("");
    setBody("");
  }, [open, application?.id]);

  function pickTemplate(id: string) {
    setTemplateId(id);
    const found = (templates.data ?? []).find((template) => template.id === id);
    if (!found) return;
    setSubject(found.subject);
    setBody(found.body);
  }

  const send = useMutation({
    mutationFn: () => sendApplicationEmail(application!.id, { subject: subject.trim(), body: body.trim() }),
    onSuccess: () => {
      onSent();
      onClose();
    },
    onError: (ex: unknown) => setError(apiErrorMessage(ex, t("recruiter.email.failed"))),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!subject.trim() || !body.trim()) {
      setError(t("recruiter.email.required"));
      return;
    }
    send.mutate();
  }

  return (
    <Modal
      open={open}
      title={t("recruiter.email.title")}
      lead={
        application
          ? t("recruiter.email.lead", {
              name: application.applicantName || t("recruiter.candidates.anonymous"),
              email: application.applicantEmail || "—",
            })
          : undefined
      }
      size="lg"
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={send.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="email-form" icon="send" loading={send.isPending}>
            {t("recruiter.email.send")}
          </Button>
        </>
      }
    >
      <form id="email-form" className="jp-modal-form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {!application?.applicantEmail && <Alert tone="warning">{t("recruiter.email.noEmail")}</Alert>}

        <Field id="email-template" label={t("recruiter.email.template")} optional>
          <select
            id="email-template"
            className="jp-input"
            value={templateId}
            onChange={(e) => pickTemplate(e.target.value)}
          >
            <option value="">{t("recruiter.email.noTemplate")}</option>
            {(templates.data ?? []).map((template) => (
              <option key={template.id} value={template.id}>
                {template.name}
              </option>
            ))}
          </select>
        </Field>

        <Field id="email-subject" label={t("recruiter.email.subject")} required>
          <Input
            id="email-subject"
            value={subject}
            maxLength={SUBJECT_MAX}
            onChange={(e) => setSubject(e.target.value)}
          />
        </Field>

        <Field
          id="email-body"
          label={t("recruiter.email.body")}
          required
          hint={t("recruiter.email.counter", {
            length: body.length.toLocaleString("vi-VN"),
            max: BODY_MAX.toLocaleString("vi-VN"),
          })}
        >
          <Textarea
            id="email-body"
            rows={10}
            maxLength={BODY_MAX}
            value={body}
            onChange={(e) => setBody(e.target.value)}
          />
        </Field>

        <p className="jp-muted jp-modal-note">
          {t("recruiter.email.placeholders")}{" "}
          {PLACEHOLDERS.map((placeholder) => (
            <code key={placeholder} className="jp-code">
              {placeholder}
            </code>
          ))}
        </p>
      </form>
    </Modal>
  );
}
