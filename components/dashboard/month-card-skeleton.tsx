import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * The streaming fallback every month-review card shares. The title is real
 * text, not a grey bar: the card's identity is known before its data is, so
 * the section's shape doesn't shuffle as the widgets land.
 */
export function MonthCardSkeleton({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {[0, 1, 2].map((index) => (
          <div key={index} className="flex flex-col gap-1.5">
            <Skeleton className="h-3 w-2/3" />
            <Skeleton className="h-2 w-full rounded-sm" />
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
