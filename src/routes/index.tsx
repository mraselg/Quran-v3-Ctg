import { createFileRoute } from "@tanstack/react-router";
import { Dashboard } from "@/components/studio/Dashboard";

export const Route = createFileRoute("/")({
  component: Index,
  head: () => ({
    meta: [
      { title: "Studio Al-Qalam — Dashboard" },
      {
        name: "description",
        content:
          "Studio Al-Qalam Dashboard: Manage your Quranic templates and projects.",
      },
    ],
  }),
});

function Index() {
  return <Dashboard />;
}
