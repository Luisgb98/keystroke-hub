import { Skeleton } from "@/components/ui/skeleton";

export default function ImprovementsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="font-heading text-h1 font-semibold">
        Improvements backlog
      </h1>
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-8 w-48 rounded-lg" />
      <div className="flex flex-col gap-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
