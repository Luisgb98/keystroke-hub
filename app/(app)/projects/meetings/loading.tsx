import { Skeleton } from "@/components/ui/skeleton";

export default function MeetingsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="font-heading text-h1 font-semibold">Meeting notes</h1>
      <Skeleton className="h-48 rounded-xl" />
      <Skeleton className="h-8 w-full rounded-lg" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    </div>
  );
}
