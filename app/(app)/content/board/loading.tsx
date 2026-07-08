import { Skeleton } from "@/components/ui/skeleton";

export default function BoardLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="font-heading text-h1 font-semibold">Board</h1>
      <div className="flex flex-1 gap-3 overflow-x-auto pb-4">
        <Skeleton className="h-full w-[85vw] shrink-0 rounded-xl sm:w-80" />
        <Skeleton className="h-full w-[85vw] shrink-0 rounded-xl sm:w-80" />
        <Skeleton className="h-full w-[85vw] shrink-0 rounded-xl sm:w-80" />
      </div>
    </div>
  );
}
