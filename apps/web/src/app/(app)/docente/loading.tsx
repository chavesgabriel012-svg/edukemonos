import { Loading, Skeleton } from "@/components/ui/skeleton";

/** The teacher panel while the section's numbers are computed. */
export default function TeacherLoading() {
  return (
    <Loading label="Cargando el panel…" className="min-h-[60vh] space-y-6">
      <Skeleton className="h-10 w-72 max-w-full" />
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-24 rounded-[22px]" />)}
      </div>
      <Skeleton className="h-48 rounded-[22px]" />
      <Skeleton className="h-80 rounded-[22px]" />
    </Loading>
  );
}
