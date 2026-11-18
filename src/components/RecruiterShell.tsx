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
  className,
  children,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
  children: ReactNode;
}) {
  return (
    <main className={className ? `jp-page ${className}` : "jp-page"}>
      <PageHead title={title} lead={lead} actions={actions} back={back} />
      {children}
    </main>
  );
}
