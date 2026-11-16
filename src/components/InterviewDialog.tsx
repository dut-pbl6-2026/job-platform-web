import { useEffect, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { useMutation } from "@tanstack/react-query";
import { Alert, Button, Checkbox, Field, Input, Modal, Textarea } from "../components/ui";
import { apiErrorMessage } from "../lib/http";
import { createInterview, type InterviewMutation, type InterviewMode } from "../lib/engagementApi";
import type { Application } from "../types/application";
import { showToast } from "../lib/toastBus";

const DURATIONS = [30, 45, 60, 90, 120];

function defaultDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

/** Local date + time from the form → UTC instant the API stores and the .ics files carry. */
function toUtcIso(date: string, time: string): string {
  const local = new Date(`${date}T${time}:00`);
  return Number.isNaN(local.getTime()) ? "" : local.toISOString();
}

/**
 * Schedules one interview and asks app-svc to email the invite with its .ics file. A failure to send
 * is reported separately: the interview is still saved and can be shown on the calendar.
 */
export function InterviewDialog({
  open,
  application,
  onClose,
  onCreated,
}: {
  open: boolean;
  application: Application | null;
  onClose: () => void;
  onCreated: (result: InterviewMutation) => void;
}) {
  const { t } = useTranslation();
  const [date, setDate] = useState(defaultDate);
  const [time, setTime] = useState("09:00");
  const [duration, setDuration] = useState("45");
  const [mode, setMode] = useState<InterviewMode>("online");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [sendInvite, setSendInvite] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // A different applicant gets a clean form; the dialog stays mounted for the focus handling.
  // biome-ignore lint/correctness/useExhaustiveDependencies: open and the application are the reset triggers.
  useEffect(() => {
    if (!open) return;
    setError(null);
    setDate(defaultDate());
    setTime("09:00");
    setDuration("45");
    setMode("online");
    setLocation("");
    setNotes("");
    setSendInvite(true);
  }, [open, application?.id]);

  const create = useMutation({
    mutationFn: () =>
      createInterview({
        applicationId: application!.id,
        startsAtUtc: toUtcIso(date, time),
        durationMinutes: Number(duration),
        mode,
        location: location.trim() || null,
        notes: notes.trim() || null,
        sendInvite,
      }),
    onSuccess: (result) => {
      showToast({
        title: result.inviteSent ? t("recruiter.interview.sent") : t("recruiter.interview.savedNoMail"),
        kind: result.inviteSent ? "success" : "warning",
      });
      onCreated(result);
      onClose();
    },
    onError: (ex: unknown) => setError(apiErrorMessage(ex, t("recruiter.interview.failed"))),
  });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    if (!application || !toUtcIso(date, time)) {
      setError(t("recruiter.interview.invalidTime"));
      return;
    }
    create.mutate();
  }

  return (
    <Modal
      open={open}
      title={t("recruiter.interview.title")}
      lead={
        application
          ? t("recruiter.interview.lead", {
              name: application.applicantName || application.applicantEmail || t("recruiter.candidates.anonymous"),
            })
          : undefined
      }
      onClose={onClose}
      footer={
        <>
          <Button variant="secondary" type="button" onClick={onClose} disabled={create.isPending}>
            {t("common.cancel")}
          </Button>
          <Button type="submit" form="interview-form" icon="calendar" loading={create.isPending}>
            {t("recruiter.interview.schedule")}
          </Button>
        </>
      }
    >
      <form id="interview-form" className="jp-modal-form" onSubmit={onSubmit} noValidate>
        {error && <Alert tone="error">{error}</Alert>}
        {application && !application.applicantEmail && <Alert tone="warning">{t("recruiter.interview.noEmail")}</Alert>}

        <div className="jp-form-row">
          <Field id="interview-date" label={t("recruiter.interview.date")} required>
            <Input
              id="interview-date"
              type="date"
              value={date}
              min={new Date().toISOString().slice(0, 10)}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field id="interview-time" label={t("recruiter.interview.time")} required>
            <Input id="interview-time" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          </Field>
          <Field id="interview-duration" label={t("recruiter.interview.duration")} required>
            <select
              id="interview-duration"
              className="jp-input"
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
            >
              {DURATIONS.map((minutes) => (
                <option key={minutes} value={minutes}>
                  {t("recruiter.interview.minutes", { count: minutes })}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field id="interview-mode" label={t("recruiter.interview.mode")} required>
          <select
            id="interview-mode"
            className="jp-input"
            value={mode}
            onChange={(e) => setMode(e.target.value as InterviewMode)}
          >
            <option value="online">{t("recruiter.interview.modeOnline")}</option>
            <option value="onsite">{t("recruiter.interview.modeOnsite")}</option>
            <option value="phone">{t("recruiter.interview.modePhone")}</option>
          </select>
        </Field>

        <Field
          id="interview-location"
          label={mode === "online" ? t("recruiter.interview.link") : t("recruiter.interview.location")}
          hint={mode === "online" ? t("recruiter.interview.linkHint") : undefined}
        >
          <Input
            id="interview-location"
            value={location}
            placeholder={mode === "online" ? "https://meet.google.com/…" : t("recruiter.interview.locationPlaceholder")}
            onChange={(e) => setLocation(e.target.value)}
          />
        </Field>

        <Field id="interview-notes" label={t("recruiter.interview.notes")} optional>
          <Textarea
            id="interview-notes"
            rows={3}
            value={notes}
            placeholder={t("recruiter.interview.notesPlaceholder")}
            onChange={(e) => setNotes(e.target.value)}
          />
        </Field>

        <Checkbox
          label={t("recruiter.interview.sendInvite")}
          checked={sendInvite}
          onChange={(e) => setSendInvite(e.target.checked)}
        />
        <p className="jp-muted jp-modal-note">{t("recruiter.interview.sendInviteNote")}</p>
      </form>
    </Modal>
  );
}
