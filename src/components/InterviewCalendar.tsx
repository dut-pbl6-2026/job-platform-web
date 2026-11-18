import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import { Button, EmptyState, Icon, StatusMark, cx } from "./ui";
import type { Interview } from "../lib/engagementApi";

const WEEKDAYS = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];

function startOfMonth(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function dayKey(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function timeLabel(iso: string): string {
  return new Date(iso).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" });
}

function whenLabel(iso: string): string {
  return new Date(iso).toLocaleString("vi-VN", {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * A month grid plus a readable list. The grid groups interviews by their local date (the API sends
 * UTC); the list carries the detail and actions, so the calendar also works with a screen reader.
 */
export function InterviewCalendar({
  interviews,
  viewer,
  onCancel,
  cancellingId,
}: {
  interviews: Interview[];
  viewer: "recruiter" | "candidate";
  onCancel?: (interview: Interview) => void;
  cancellingId?: string | null;
}) {
  const { t } = useTranslation();
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<Date | null>(null);

  const byDay = useMemo(() => {
    const map = new Map<string, Interview[]>();
    for (const interview of interviews) {
      const key = dayKey(new Date(interview.startsAtUtc));
      map.set(key, [...(map.get(key) ?? []), interview]);
    }
    for (const list of map.values()) {
      list.sort((a, b) => +new Date(a.startsAtUtc) - +new Date(b.startsAtUtc));
    }
    return map;
  }, [interviews]);

  const cells = useMemo(() => {
    const first = startOfMonth(month);
    const offset = (first.getDay() + 6) % 7; // Monday-first
    const start = new Date(first);
    start.setDate(first.getDate() - offset);
    return Array.from({ length: 42 }, (_, index) => {
      const day = new Date(start);
      day.setDate(start.getDate() + index);
      return day;
    });
  }, [month]);

  const monthInterviews = useMemo(
    () =>
      interviews
        .filter((interview) => {
          const date = new Date(interview.startsAtUtc);
          return date.getFullYear() === month.getFullYear() && date.getMonth() === month.getMonth();
        })
        .sort((a, b) => +new Date(a.startsAtUtc) - +new Date(b.startsAtUtc)),
    [interviews, month],
  );

  const listed = selected
    ? monthInterviews.filter((interview) => sameDay(new Date(interview.startsAtUtc), selected))
    : monthInterviews;

  const monthLabel = month.toLocaleDateString("vi-VN", { month: "long", year: "numeric" });

  function shift(delta: number) {
    setSelected(null);
    setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));
  }

  return (
    <div className="jp-cal-wrap">
      <div className="jp-cal">
        <div className="jp-cal-bar">
          <Button variant="ghost" size="sm" icon="chevronLeft" onClick={() => shift(-1)}>
            <span className="jp-sr-only">{t("interviews.previousMonth")}</span>
          </Button>
          <div className="jp-cal-month">
            <strong>{monthLabel.charAt(0).toUpperCase() + monthLabel.slice(1)}</strong>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setSelected(null);
                setMonth(startOfMonth(new Date()));
              }}
            >
              {t("interviews.today")}
            </Button>
          </div>
          <Button variant="ghost" size="sm" icon="chevronRight" onClick={() => shift(1)}>
            <span className="jp-sr-only">{t("interviews.nextMonth")}</span>
          </Button>
        </div>

        <div className="jp-cal-grid" role="grid" aria-label={t("interviews.gridLabel", { month: monthLabel })}>
          {WEEKDAYS.map((weekday) => (
            <div className="jp-cal-weekday" role="columnheader" tabIndex={-1} key={weekday}>
              {weekday}
            </div>
          ))}
          {cells.map((day) => {
            const events = byDay.get(dayKey(day)) ?? [];
            const outside = day.getMonth() !== month.getMonth();
            const isToday = sameDay(day, new Date());
            const active = selected ? sameDay(day, selected) : false;
            return (
              <button
                type="button"
                role="gridcell"
                key={day.toISOString()}
                className={cx(
                  "jp-cal-day",
                  outside && "is-outside",
                  isToday && "is-today",
                  active && "is-selected",
                  events.length > 0 && "has-events",
                )}
                aria-label={t("interviews.dayLabel", { date: whenLabel(day.toISOString()), count: events.length })}
                onClick={() => setSelected(active ? null : day)}
              >
                <span className="jp-cal-date">{day.getDate()}</span>
                <span className="jp-cal-events">
                  {events.slice(0, 2).map((interview) => (
                    <span
                      key={interview.id}
                      className={cx("jp-cal-event", interview.status === "cancelled" && "is-cancelled")}
                    >
                      {timeLabel(interview.startsAtUtc)} {interview.jobTitle}
                    </span>
                  ))}
                  {events.length > 2 && (
                    <span className="jp-cal-more">{t("interviews.more", { count: events.length - 2 })}</span>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="jp-cal-list-wrap">
        <div className="jp-cal-list-head">
          <h3>
            {selected
              ? t("interviews.dayTitle", { date: whenLabel(selected.toISOString()).split(",")[0] })
              : t("interviews.monthTitle")}
          </h3>
          {selected && (
            <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
              {t("interviews.showAll")}
            </Button>
          )}
        </div>

        {listed.length === 0 ? (
          <EmptyState title={t("interviews.empty")}>{t("interviews.emptyText")}</EmptyState>
        ) : (
          <ul className="jp-interview-list">
            {listed.map((interview) => {
              const cancelled = interview.status === "cancelled";
              const counterpart =
                viewer === "recruiter"
                  ? interview.applicantName || interview.applicantEmail
                  : interview.recruiterName || interview.recruiterEmail;
              return (
                <li key={interview.id} className={cx("jp-interview", cancelled && "is-cancelled")}>
                  <div className="jp-interview-when">
                    <strong>{timeLabel(interview.startsAtUtc)}</strong>
                    <span>{whenLabel(interview.startsAtUtc).split(",")[0]}</span>
                    <span>{t("interviews.minutes", { count: interview.durationMinutes })}</span>
                  </div>
                  <div className="jp-interview-body">
                    <div className="jp-interview-title">
                      <Link to={`/jobs/${interview.jobId}`}>{interview.jobTitle}</Link>
                      {cancelled && <StatusMark tone="danger">{t("interviews.cancelled")}</StatusMark>}
                    </div>
                    <p className="jp-interview-meta">
                      <span>
                        <Icon
                          name={interview.mode === "online" ? "video" : interview.mode === "phone" ? "phone" : "pin"}
                          size={14}
                        />
                        {t(`interviews.mode.${interview.mode}`)}
                      </span>
                      {interview.location && <span className="jp-interview-place">{interview.location}</span>}
                      <span>
                        <Icon name="users" size={14} />
                        {counterpart}
                      </span>
                    </p>
                    {interview.notes && <p className="jp-interview-notes">{interview.notes}</p>}
                    {viewer === "recruiter" && !cancelled && onCancel && (
                      <div className="jp-interview-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon="x"
                          loading={cancellingId === interview.id}
                          onClick={() => onCancel(interview)}
                        >
                          {t("interviews.cancel")}
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
