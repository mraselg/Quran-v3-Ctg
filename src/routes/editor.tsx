import { createFileRoute } from "@tanstack/react-router";
import { Workspace } from "@/components/studio/Workspace";

export const Route = createFileRoute("/editor")({
  component: EditorPage,
  head: () => ({
    meta: [
      { title: "Studio Al-Qalam — Editor" },
    ],
  }),
});

function EditorPage() {
  return <Workspace />;
}
