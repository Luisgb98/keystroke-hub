import { after } from "next/server";

/**
 * Schedules `fn` via `after()`, swallowing a synchronous throw from `after`
 * itself (rather than the callback) — matches the "push failures never
 * block or fail the mutation" contract in docs/google-sync.md, extended to
 * the scheduling call itself in case the request scope `after` needs isn't
 * available for some reason.
 *
 * Lives here rather than in `lib/calendar/actions.ts` because a `"use server"`
 * module may only export async functions, and the stream planner's own delete
 * (issue #104) has to push exactly the same way the calendar's does.
 */
export function schedulePush(fn: () => Promise<void>): void {
  try {
    after(fn);
  } catch (error) {
    console.error("Failed to schedule Google Calendar push:", error);
  }
}
