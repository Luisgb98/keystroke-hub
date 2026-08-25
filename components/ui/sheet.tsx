"use client";

import { Dialog as DialogPrimitive } from "@base-ui/react/dialog";

import { cn } from "@/lib/utils";

/**
 * A bottom-anchored sheet: the same modal primitive as `dialog.tsx`, docked to
 * the bottom edge and sized by its content instead of centred and capped. It's
 * the phone-native shape for a short list of choices — it opens under the
 * thumb rather than in the middle of the screen (#114).
 *
 * Built on Base UI's `Dialog` rather than a second primitive so focus
 * trapping, scroll locking and Esc behave identically to every other modal in
 * the app.
 */
function Sheet({ ...props }: DialogPrimitive.Root.Props) {
  return <DialogPrimitive.Root data-slot="sheet" {...props} />;
}

function SheetTrigger({ ...props }: DialogPrimitive.Trigger.Props) {
  return <DialogPrimitive.Trigger data-slot="sheet-trigger" {...props} />;
}

function SheetClose({ ...props }: DialogPrimitive.Close.Props) {
  return <DialogPrimitive.Close data-slot="sheet-close" {...props} />;
}

function SheetOverlay({ className, ...props }: DialogPrimitive.Backdrop.Props) {
  return (
    <DialogPrimitive.Backdrop
      data-slot="sheet-overlay"
      className={cn(
        "fixed inset-0 isolate z-50 bg-black/20 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",
        className
      )}
      {...props}
    />
  );
}

function SheetContent({
  className,
  children,
  ...props
}: DialogPrimitive.Popup.Props) {
  return (
    <DialogPrimitive.Portal data-slot="sheet-portal">
      <SheetOverlay />
      <DialogPrimitive.Popup
        data-slot="sheet-content"
        className={cn(
          // `max-h-[85svh]` + an internal scroll keeps a long sheet reachable
          // on a short phone; `svh` rather than `vh` so the mobile browser's
          // collapsing toolbar can't push the bottom of the sheet off-screen.
          // The safe-area padding pairs with the root layout's
          // `viewportFit: "cover"` — without that, the inset resolves to 0.
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[85svh] flex-col gap-4 overflow-y-auto rounded-t-2xl bg-popover p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-sm text-popover-foreground ring-1 ring-foreground/10 duration-150 outline-none data-open:animate-in data-open:slide-in-from-bottom data-closed:animate-out data-closed:slide-out-to-bottom",
          className
        )}
        {...props}
      >
        {/* Purely decorative grab handle — the affordance that says "this came
            from the bottom edge and goes back there". */}
        <span
          aria-hidden
          data-slot="sheet-handle"
          className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border"
        />
        {children}
      </DialogPrimitive.Popup>
    </DialogPrimitive.Portal>
  );
}

function SheetTitle({ className, ...props }: DialogPrimitive.Title.Props) {
  return (
    <DialogPrimitive.Title
      data-slot="sheet-title"
      className={cn(
        "font-heading text-base leading-none font-medium",
        className
      )}
      {...props}
    />
  );
}

function SheetDescription({
  className,
  ...props
}: DialogPrimitive.Description.Props) {
  return (
    <DialogPrimitive.Description
      data-slot="sheet-description"
      className={cn("text-sm text-muted-foreground", className)}
      {...props}
    />
  );
}

export {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetOverlay,
  SheetTitle,
  SheetTrigger,
};
