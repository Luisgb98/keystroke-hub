"use client";

import * as React from "react";
import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { XIcon } from "lucide-react";

function Dialog({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
}

function DialogTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
}

function DialogPortal({ ...props }: DialogPrimitive.Portal.Props) {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
}

function DialogClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
}

function DialogOverlay({
  className,
  ...props
}: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="dialog-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

function DialogContent({
  className,
  children,
  showCloseButton = true,
  variant = "centered",
  ...props
}: DialogPrimitive.Popup.Props & {
  showCloseButton?: boolean;
  /**
   * `"centered"` — a centred panel at every width. Right for short,
   * glanceable content: a confirmation, a picker, a one-field prompt.
   *
   * `"sheet"` — a bottom sheet below `md`, the same centred panel from `md`
   * up. Right for anything form-shaped: on a phone it opens under the thumb,
   * spans the full width, and pins its footer so Save is never buried under
   * the keyboard or below the fold (#114). Pair it with `DialogBody`, which is
   * the part that scrolls.
   *
   * The switch is pure CSS — one DOM tree, no breakpoint hook, so nothing can
   * mismatch between the server render and the hydrated one.
   */
  variant?: "centered" | "sheet";
}) {
  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Popup
        data-slot="dialog-content"
        data-variant={variant}
        className={cn(
          // `[&>*]:min-w-0`: a grid item's (and a row-flex item's)
          // `min-width: auto` floors it at its own min-content width — so one
          // long unbreakable string anywhere inside could make the whole
          // panel's contents wider than `max-w-*` and paint outside the dialog
          // (#102 hit this in `EventEditor` via a long linked-idea title).
          // Zeroing the floor on direct children makes `max-w-*` authoritative
          // and lets the `truncate`/wrap rules inside actually apply.
          // `[&>*]:min-h-0` is the vertical twin, and it's what lets a
          // `DialogBody` inside a full-height form actually scroll instead of
          // stretching the sheet past the viewport.
          "group/dialog-content fixed z-50 gap-4 bg-popover p-4 text-sm text-popover-foreground ring-1 ring-foreground/10 duration-100 outline-none [&>*]:min-h-0 [&>*]:min-w-0",
          variant === "centered" &&
            "top-1/2 left-1/2 grid w-full max-w-[calc(100%-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-xl sm:max-w-sm data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95",
          variant === "sheet" && [
            "flex flex-col",
            // Phone: docked to the bottom edge, full width, capped so a long
            // form scrolls inside itself. `svh`, not `dvh` — a mobile
            // browser's collapsing toolbar must not be able to push the
            // footer off-screen mid-scroll.
            "inset-x-0 bottom-0 max-h-[92svh] rounded-t-2xl",
            // The home-indicator inset, for sheets with no footer. A
            // `DialogFooter` cancels this exactly and carries the inset on its
            // own surface instead — see `DialogFooter`.
            "max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]",
            "max-md:data-open:animate-in max-md:data-open:slide-in-from-bottom max-md:data-closed:animate-out max-md:data-closed:slide-out-to-bottom",
            // Desktop: exactly the centred panel, so nothing about the
            // dense-viewport design changes.
            "md:inset-x-auto md:top-1/2 md:bottom-auto md:left-1/2 md:max-h-[90dvh] md:w-full md:max-w-md md:-translate-x-1/2 md:-translate-y-1/2 md:rounded-xl",
            "md:data-open:animate-in md:data-open:fade-in-0 md:data-open:zoom-in-95 md:data-closed:animate-out md:data-closed:fade-out-0 md:data-closed:zoom-out-95",
          ],
          className
        )}
        {...props}
      >
        {children}
        {showCloseButton && (
          <DialogPrimitive.Close
            data-slot="dialog-close"
            render={
              <Button
                variant="ghost"
                className="absolute top-2 right-2"
                size="icon-sm"
              />
            }
          >
            <XIcon />
            <span className="sr-only">Close</span>
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Popup>
    </DialogPortal>
  );
}

function DialogHeader({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-header"
      className={cn("flex shrink-0 flex-col gap-2", className)}
      {...props}
    />
  );
}

/**
 * The scrollable middle of a `variant="sheet"` dialog: header and footer stay
 * put, only the fields move. That's what keeps Save reachable — before #114 the
 * whole panel scrolled, so on a 390px screen the idea editor's Save button sat
 * below the fold with the title scrolled away above it.
 *
 * The negative margin plus matching padding gives focus rings room inside the
 * scroll container, which would otherwise clip them at its edges.
 */
function DialogBody({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      data-slot="dialog-body"
      className={cn(
        "-mx-4 flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto overscroll-contain px-4",
        className
      )}
      {...props}
    />
  );
}

function DialogFooter({
  className,
  showCloseButton = false,
  children,
  ...props
}: React.ComponentProps<"div"> & {
  showCloseButton?: boolean;
}) {
  return (
    <div
      data-slot="dialog-footer"
      className={cn(
        "-mx-4 -mb-4 flex shrink-0 flex-col-reverse gap-2 rounded-b-xl border-t bg-muted/50 p-4 sm:flex-row sm:justify-end",
        // In a bottom sheet the footer *is* the bottom edge, so it carries the
        // home-indicator inset itself — its own surface fills the safe area
        // rather than leaving a bare strip under it. Scoped to the sheet
        // variant: a centred dialog isn't at the bottom edge and must not
        // grow a phantom gap on a notched phone.
        "group-data-[variant=sheet]/dialog-content:max-md:-mb-[calc(1rem+env(safe-area-inset-bottom))] group-data-[variant=sheet]/dialog-content:max-md:rounded-b-none group-data-[variant=sheet]/dialog-content:max-md:pb-[calc(1rem+env(safe-area-inset-bottom))]",
        className
      )}
      {...props}
    >
      {children}
      {showCloseButton && (
        <DialogPrimitive.Close render={<Button variant="outline" />}>
          Close
        </DialogPrimitive.Close>
      )}
    </div>
  );
}

function DialogTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="dialog-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  );
}

function DialogDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="dialog-description"
      className={cn(
        "text-sm text-muted-foreground *:[a]:underline *:[a]:underline-offset-3 *:[a]:hover:text-foreground",
        className
      )}
      {...props}
    />
  );
}

export {
  Dialog,
  DialogBody,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogPortal,
  DialogTitle,
  DialogTrigger,
};
