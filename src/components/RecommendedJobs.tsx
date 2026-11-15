import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Alert, Board, Button, JobRow, SkeletonRows } from "./ui";
import { useAuth } from "../contexts/AuthContext";
import { fetchRecommendedJobs } from "../lib/jobsApi";
import { isUser } from "../lib/roles";
import { loadErrorMessage } from "../lib/http";

/**
 * "Việc làm gợi ý cho bạn" for signed-in Users only (PBL6-65). Recruiters and Admins never request it:
 * the query is disabled for them, so the gateway's User policy is not hit. An empty result hides the
 * section, as on mobile. A failed call shows the error with a retry.
 */
export function RecommendedJobs() {
  const { isAuthenticated, user } = useAuth();
  const enabled = isAuthenticated && isUser(user?.role);
  // "Làm mới gợi ý" asks the backend to bypass its per-user cache for this load only.
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
            Việc làm gợi ý cho bạn
          </h2>
          <p className="jp-reco-lead">Cá nhân hóa theo hồ sơ và kỹ năng của bạn</p>
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
          Làm mới gợi ý
        </Button>
      </div>

      {query.isPending && <SkeletonRows rows={3} label="Đang tải việc làm gợi ý" />}

      {query.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" onClick={() => void query.refetch()}>
              Thử lại
            </Button>
          }
        >
          {loadErrorMessage(query.error, "việc làm gợi ý")}
        </Alert>
      )}

      {query.isSuccess && query.data.length > 0 && (
        <Board label="Việc làm gợi ý">
          {query.data.map(({ job, reason }) => (
            <JobRow key={job.id} job={job} note={reason || undefined} />
          ))}
        </Board>
      )}
    </section>
  );
}
