import { Skeleton } from "@/components/ui/skeleton";

export default function ProjectsLoading() {
  return (
    <div className="flex flex-1 flex-col gap-4 px-4 py-6 sm:px-10 sm:py-8">
      <h1 className="font-heading text-h1 font-semibold">
        Projects & Meetings
      </h1>
      <Skeleton className="h-24 rounded-xl" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );
}
