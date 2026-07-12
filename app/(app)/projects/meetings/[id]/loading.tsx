import { Skeleton } from "@/components/ui/skeleton";

export default function MeetingNoteDetailLoading() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-4 py-6 sm:mx-auto sm:w-full sm:max-w-2xl sm:px-10 sm:py-8">
      <Skeleton className="h-8 w-40 rounded-lg" />
      <Skeleton className="h-64 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
      <Skeleton className="h-24 rounded-xl" />
    </div>
  );
}
