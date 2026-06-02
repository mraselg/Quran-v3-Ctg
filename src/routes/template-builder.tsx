import { createFileRoute } from "@tanstack/react-router";
import { TemplateBuilder } from "@/components/studio/TemplateBuilder";

export const Route = createFileRoute("/template-builder")({
  component: TemplateBuilderPage,
  head: () => ({
    meta: [
      { title: "Studio Al-Qalam — Template Builder" },
    ],
  }),
});

function TemplateBuilderPage() {
  return <TemplateBuilder />;
}
