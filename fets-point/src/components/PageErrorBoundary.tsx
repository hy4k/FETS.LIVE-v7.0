import { Component, type ReactNode } from "react";
/** Contain a page render failure while leaving navigation usable. */
export class PageErrorBoundary extends Component<
  { children: ReactNode; onHome: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("Page rendering failed:", error);
  }
  render() {
    return this.state.failed ? (
      <section
        role="alert"
        data-page-error
        style={{
          padding: 24,
          margin: 20,
          border: "1px solid #d5dce1",
          borderRadius: 12,
          background: "#fff",
          color: "#26313c",
        }}
      >
        <h2>This page could not be displayed</h2>
        <p>Try this page again, or use the menu to continue elsewhere.</p>
        <div style={{ display: "flex", gap: 12 }}>
          <button
            onClick={() => this.setState({ failed: false })}
            style={{
              padding: "10px 16px",
              border: "1px solid #ccd4db",
              borderRadius: 8,
            }}
          >
            Retry page
          </button>
          <button
            onClick={this.props.onHome}
            style={{
              padding: "10px 16px",
              border: "1px solid #ccd4db",
              borderRadius: 8,
            }}
          >
            Go to home
          </button>
        </div>
      </section>
    ) : (
      this.props.children
    );
  }
}
