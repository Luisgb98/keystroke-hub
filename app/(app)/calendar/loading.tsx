import { Skeleton } from "@/components/ui/skeleton";

export default function CalendarLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="font-heading text-h1 font-semibold">Calendar</h1>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Skeleton className="h-8 w-40 max-w-full sm:w-48" />
        <Skeleton className="h-8 w-32 max-w-full sm:w-40" />
      </div>
      <Skeleton className="flex-1 rounded-2xl" />
    </div>
  );
}
