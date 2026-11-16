import type { ReactNode } from "react";
import { PageHead } from "./ui";

/**
 * Presentational wrapper for an admin screen. The console shell (top bar, sidebar, account) is
 * provided by WorkspaceLayout; RequireRole guards the routes.
 */
export function AdminShell({
  title,
  lead,
  actions,
  children,
}: {
  title: string;
  lead?: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  return (
    <main className="jp-page">
      <PageHead title={title} lead={lead} actions={actions} />
      {children}
    </main>
  );
}
