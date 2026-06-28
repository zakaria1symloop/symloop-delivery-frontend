"use client";

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

/* ReactFlow relies on browser APIs (window/ResizeObserver) — load client-side only. */
const WorkflowBuilder = dynamic(() => import("./WorkflowBuilder"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "calc(100vh - 11rem)" }}>
      <Loader2 size={22} className="animate-spin" style={{ color: "#f97316" }} />
    </div>
  ),
});

export default function WorkflowPage() {
  return <WorkflowBuilder />;
}
