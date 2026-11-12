import { Loading, Skeleton } from "@/components/ui/skeleton";

export default function SubjectLoading() {
  return (
    <Loading label="Cargando los temas…" className="min-h-[60vh] space-y-8">
      <div className="space-y-3">
        <Skeleton className="h-5 w-40" />
        <Skeleton className="h-36 rounded-[28px] sm:h-44" />
      </div>
      <Skeleton className="h-28 rounded-[22px]" />
      <div className="space-y-2">
        <Skeleton className="mb-4 h-9 w-40" />
        {[0, 1, 2, 3, 4, 5].map((i) => <Skeleton key={i} className="h-[74px] rounded-[18px]" />)}
      </div>
    </Loading>
  );
}
