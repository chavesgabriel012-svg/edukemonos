import { Loading, Skeleton } from "@/components/ui/skeleton";

/** A page whose shape is not worth drawing in detail: a title, a line and three cards. */
export function PageSkeleton() {
  return (
    <Loading className="min-h-[60vh] space-y-6">
      <Skeleton className="h-10 w-2/3 max-w-md" />
      <Skeleton className="h-5 w-full max-w-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <Skeleton key={i} className="h-36 rounded-[22px]" />)}
      </div>
    </Loading>
  );
}
