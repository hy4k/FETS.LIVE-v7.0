import React from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import RedesignShell from "../redesign/RedesignShell";
const w = window as any;
w.auditErrors = [];
class Boundary extends React.Component<any, any> {
  state = { error: "" };
  static getDerivedStateFromError(e: any) {
    return { error: e.message };
  }
  componentDidCatch(e: any) {
    w.auditErrors.push(e.stack || e.message);
  }
  render() {
    return this.state.error ? (
      <div role="alert">Render failure: {this.state.error}</div>
    ) : (
      this.props.children
    );
  }
}
const params = new URLSearchParams(location.search);
const qc = new QueryClient({
  defaultOptions: {
    queries: { retry: false, refetchOnWindowFocus: false },
    mutations: { retry: false },
  },
});
createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={qc}>
    <Boundary>
      <RedesignShell
        activeSubPage={params.get("page") || "calendar"}
        activeBranch={params.get("branch") || "calicut"}
        userName="Example Administrator"
        userEmail="mithun@fets.in"
        isAdmin={true}
        profileBranch="calicut"
        bridge={() => {}}
        onLogout={() => {}}
      />
    </Boundary>
  </QueryClientProvider>,
);
