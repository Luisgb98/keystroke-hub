import { Skeleton } from "@/components/ui/skeleton";

export default function JournalLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <div className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-h1 font-semibold">Journal</h1>
        <Skeleton className="h-7 w-24" />
      </div>
      <Skeleton className="h-9 w-full" />
      <Skeleton className="flex-1 rounded-2xl" />
    </div>
  );
}
