import React from "react";

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

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
        <div className="container">
          <div className="card" style={{ marginTop: 24 }}>
            <h3 style={{ marginTop: 0 }}>Đã xảy ra lỗi</h3>
            <p className="hint">{this.state.error?.message || "Ứng dụng gặp lỗi ngoài dự kiến."}</p>
            <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
              <button className="btn btn-primary" onClick={this.handleReset}>Thử lại</button>
              <a className="btn btn-ghost" href="/jobs">Về trang việc làm</a>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
