import { LoadingState, Skeleton } from "@/components/ui/States";

export default function AppRouteLoading() {
  return (
    <main className="page route-loading" aria-label="Opening page">
      <LoadingState compact label="Opening your workspace" detail="Keeping your current study state in place." />
      <div className="route-loading-grid" aria-hidden="true">
        <Skeleton height="7rem" />
        <Skeleton height="7rem" />
        <Skeleton height="13rem" />
      </div>
    </main>
  );
}
