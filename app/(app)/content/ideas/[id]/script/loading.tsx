import { Skeleton } from "@/components/ui/skeleton";

export default function ScriptLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <Skeleton className="h-7 w-2/3 max-w-sm" />
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-[60vh] w-full rounded-xl" />
    </div>
  );
}
