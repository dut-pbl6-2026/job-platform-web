import type { ReactNode } from "react";
import { PageHead } from "./ui";

/**
 * Presentational wrapper for a recruiter screen. The shell (top bar, sidebar, account) is provided by
 * WorkspaceLayout; the route guard lives in RequireRole.
 */
export function RecruiterShell({
  title,
  lead,
  actions,
  back,
  children,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  back?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="jp-page">
      <PageHead title={title} lead={lead} actions={actions} back={back} />
      {children}
    </main>
  );
}
