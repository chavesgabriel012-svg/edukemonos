import { Loading, Skeleton } from "@/components/ui/skeleton";

export default function UnitLoading() {
  return (
    <Loading label="Cargando el tema…" className="mx-auto min-h-[60vh] max-w-4xl space-y-6">
      <div className="space-y-3">
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-36 rounded-[28px]" />
      </div>
      <Skeleton className="h-14 rounded-[18px]" />
      <div className="space-y-4 rounded-[22px] border bg-card p-5 sm:p-7">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-11/12" />
        <Skeleton className="h-4 w-4/5" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    </Loading>
  );
}
