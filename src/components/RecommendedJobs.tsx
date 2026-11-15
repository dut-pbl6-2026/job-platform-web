import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery } from "@tanstack/react-query";
import { Alert, Board, Button, JobRow, SkeletonRows } from "./ui";
import { useAuth } from "../contexts/AuthContext";
import { fetchRecommendedJobs } from "../lib/jobsApi";
import { isUser } from "../lib/roles";
import { loadErrorMessage } from "../lib/http";

/**
 * The "recommended jobs for you" section, for signed-in Users only (PBL6-65). Recruiters and Admins never request it:
 * the query is disabled for them, so the gateway's User policy is not hit. An empty result hides the
 * section, as on mobile. A failed call shows the error with a retry.
 */
export function RecommendedJobs() {
  const { t } = useTranslation();
  const { isAuthenticated, user } = useAuth();
  const enabled = isAuthenticated && isUser(user?.role);
  // The refresh button asks the backend to bypass its per-user cache for this load only.
  const [refresh, setRefresh] = useState(false);
  const query = useQuery({
    queryKey: ["jobs", "recommended", user?.id ?? "", refresh],
    queryFn: () => fetchRecommendedJobs({ refresh }),
    enabled,
    staleTime: 60_000,
  });

  if (!enabled) return null;
  if (query.isSuccess && query.data.length === 0) return null;

  return (
    <section className="jp-reco" aria-labelledby="jp-reco-title">
      <div className="jp-reco-head">
        <div>
          <h2 id="jp-reco-title" className="jp-reco-title">
            {t("jobs.reco.title")}
          </h2>
          <p className="jp-reco-lead">{t("jobs.reco.lead")}</p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          loading={query.isFetching}
          onClick={() => {
            setRefresh(true);
            if (refresh) void query.refetch();
          }}
        >
          {t("jobs.reco.refresh")}
        </Button>
      </div>

      {query.isPending && <SkeletonRows rows={3} label={t("jobs.reco.loading")} />}

      {query.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              {t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(query.error, t("jobs.reco.loadWhat"))}
        </Alert>
      )}

      {query.isSuccess && query.data.length > 0 && (
        <Board label={t("jobs.reco.title")}>
          {query.data.map(({ job, reason }) => (
            <JobRow key={job.id} job={job} note={reason || undefined} />
          ))}
        </Board>
      )}
    </section>
  );
}
