import { Skeleton } from "@/components/ui/skeleton";

export default function IdeaDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-9 w-3/4 max-w-md" />
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-20 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-[40vh] rounded-xl" />
    </div>
  );
}
