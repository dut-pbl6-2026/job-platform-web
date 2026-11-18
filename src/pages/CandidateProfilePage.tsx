import { useTranslation } from "react-i18next";
import { useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Alert, Button, EmptyState, PageHead, SkeletonBlock } from "../components/ui";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { fetchPublicProfile } from "../lib/profileApi";
import { formatDate } from "../lib/dates";
import { loadErrorMessage } from "../lib/http";
import { safeHttpUrl } from "../lib/safeUrl";
import type { Profile } from "../types/profile";

function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0].slice(0, 2).toUpperCase();
  return `${words[0][0]}${words[words.length - 1][0]}`.toUpperCase();
}

function range(start: string, end?: string | null): string {
  const from = start ? formatDate(start) : "";
  const to = end ? formatDate(end) : "";
  return to ? `${from} — ${to}` : from;
}

/**
 * A candidate's public profile, reachable from a recruiter's board: name, headline, summary, skills,
 * experience and education. profile-svc answers with the public DTO, so phone, address and date of
 * birth are never part of this page.
 */
export default function CandidateProfilePage() {
  const { t } = useTranslation();
  const { id = "" } = useParams();
  useDocumentTitle(t("candidateProfile.title"));

  const profile = useQuery({
    queryKey: ["profile", "public", id],
    queryFn: () => fetchPublicProfile(id),
    enabled: !!id,
  });
  const data: Profile | null | undefined = profile.data;
  const avatar = safeHttpUrl(data?.avatarUrl);

  return (
    <main className="jp-page">
      <PageHead title={t("candidateProfile.title")} lead={t("candidateProfile.lead")} />

      {profile.isPending && <SkeletonBlock height={320} label={t("candidateProfile.loading")} />}
      {profile.isError && (
        <Alert
          tone="error"
          action={
            <Button variant="secondary" loading={profile.isFetching} onClick={() => void profile.refetch()}>
              {t("jobs.retry")}
            </Button>
          }
        >
          {loadErrorMessage(profile.error, t("candidateProfile.loadWhat"))}
        </Alert>
      )}
      {data === null && !profile.isError && (
        <EmptyState title={t("candidateProfile.empty")}>{t("candidateProfile.emptyText")}</EmptyState>
      )}

      {data && (
        <article className="jp-cand-profile">
          <header className="jp-cand-profile-head">
            <span className="jp-cand-profile-avatar" aria-hidden="true">
              {avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer" /> : initials(data.fullName)}
            </span>
            <div>
              <h2 className="jp-h2">{data.fullName}</h2>
              {data.headline && <p className="jp-cand-profile-headline">{data.headline}</p>}
            </div>
          </header>

          {data.summary && (
            <section className="jp-cand-profile-section" aria-labelledby="cand-summary">
              <h3 id="cand-summary">{t("candidateProfile.summary")}</h3>
              <p>{data.summary}</p>
            </section>
          )}

          {data.skills.length > 0 && (
            <section className="jp-cand-profile-section" aria-labelledby="cand-skills">
              <h3 id="cand-skills">{t("candidateProfile.skills")}</h3>
              <ul className="jp-cand-skills">
                {data.skills.map((skill) => (
                  <li key={skill.id}>
                    <strong>{skill.name}</strong>
                    <span>
                      {t("profile.skills.meta", {
                        level: skill.proficiency,
                        years: skill.yearsOfExperience,
                      })}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.experiences.length > 0 && (
            <section className="jp-cand-profile-section" aria-labelledby="cand-experience">
              <h3 id="cand-experience">{t("candidateProfile.experience")}</h3>
              <ul className="jp-cand-timeline">
                {data.experiences.map((item) => (
                  <li key={item.id}>
                    <strong>{item.title}</strong>
                    <span>{item.company}</span>
                    <span className="jp-muted">{range(item.startDate, item.endDate)}</span>
                    {item.description && <p>{item.description}</p>}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {data.education.length > 0 && (
            <section className="jp-cand-profile-section" aria-labelledby="cand-education">
              <h3 id="cand-education">{t("candidateProfile.education")}</h3>
              <ul className="jp-cand-timeline">
                {data.education.map((item) => (
                  <li key={item.id}>
                    <strong>{item.institution}</strong>
                    <span>{[item.degree, item.field].filter(Boolean).join(" · ")}</span>
                    <span className="jp-muted">{range(item.startDate, item.endDate)}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </article>
      )}
    </main>
  );
}
