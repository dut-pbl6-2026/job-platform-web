import React from "react";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

/**
 * Last resort for a render error. It sits above the router, so it cannot use router links or the
 * shell bar: plain markup with the shared panel and button classes.
 */
export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info);
  }

  handleReset = () => this.setState({ hasError: false, error: null });

  render() {
    if (this.state.hasError) {
      return (
        <main className="jp-page jp-page--narrow">
          <div className="jp-panel jp-fatal" role="alert">
            <h1 className="jp-h2">Đã xảy ra lỗi</h1>
            <p className="jp-muted">{this.state.error?.message || "Ứng dụng gặp lỗi ngoài dự kiến."}</p>
            <div className="jp-fatal-actions">
              <button type="button" className="jp-btn jp-btn--primary" onClick={this.handleReset}>Thử lại</button>
              <a className="jp-btn jp-btn--secondary" href="/jobs">Về bảng việc làm</a>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
