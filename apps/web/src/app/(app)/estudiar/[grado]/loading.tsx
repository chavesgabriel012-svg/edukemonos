import { Loading, Skeleton } from "@/components/ui/skeleton";

export default function GradeLoading() {
  return (
    <Loading label="Cargando las materias…" className="min-h-[60vh] space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-5 w-32" />
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-11 w-72 max-w-full" />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-44 rounded-[22px]" />
        <Skeleton className="h-44 rounded-[22px]" />
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-[16px]" />)}
      </div>
    </Loading>
  );
}
