import { createFileRoute } from "@tanstack/react-router";
import { useReflowStore } from "@/state/reflowStore";
import { Artboard } from "@/components/studio/Artboard";

export const Route = createFileRoute("/print-preview")({
  component: PrintPreview,
  head: () => ({
    meta: [
      { title: "Print Preview — Quran Studio Pro" },
    ],
  }),
});

// VB_H = 630.28, SCALE = 780 / 420.17 => DISPLAY_H ≈ 1170.6px
const DISPLAY_H = 630.28 * (780 / 420.17);

function PrintPreview() {
  const pages = useReflowStore((s) => s.pages);

  return (
    <div style={{ background: "white", margin: 0, padding: 0 }}>
      {pages.map((page) => (
        <div
          key={page.id}
          style={{
            width: 780,
            height: DISPLAY_H,
            position: "relative",
            pageBreakAfter: "always",
            overflow: "hidden",
            margin: "0 auto",
            backgroundColor: "#ffffff"
          }}
        >
          <Artboard page={page} zoom={1} />
        </div>
      ))}
    </div>
  );
}
