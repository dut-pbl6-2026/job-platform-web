import type { ApplicationStatus } from "../../types/application";
import { STATUS_LABEL } from "../../types/application";
import { StatusMark, type StatusTone } from "./feedback";

/**
 * The five app-svc statuses, each with its own mark shape (see StatusMark), so the state reads in
 * grayscale: empty ring = waiting, diamond = seen, half = next round, dot = accepted, cross = rejected.
 */
const TONE: Record<ApplicationStatus, StatusTone> = {
  pending: "neutral",
  reviewed: "info",
  shortlisted: "warning",
  accepted: "success",
  rejected: "danger",
};

export function ApplicationStatusMark({ status }: { status: ApplicationStatus }) {
  return <StatusMark tone={TONE[status]}>{STATUS_LABEL[status]}</StatusMark>;
}
