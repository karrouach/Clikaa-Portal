/**
 * Sheet — right-side slide-out panel, built on @radix-ui/react-dialog.
 *
 * Re-uses the already-installed Radix Dialog primitives with different
 * positioning and animation keyframes.
 *
 * Animations (defined in tailwind.config.ts):
 *   sheet-slide-in  — slides the panel in from the right edge
 *   sheet-slide-out — slides the panel out to the right edge
 */
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Sheet = DialogPrimitive.Root
const SheetTrigger = DialogPrimitive.Trigger
const SheetClose = DialogPrimitive.Close
const SheetPortal = DialogPrimitive.Portal

// ─── Overlay ─────────────────────────────────────────────────────────────────
const SheetOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/30 backdrop-blur-[1px]',
      'data-[state=open]:animate-overlay-show',
      'data-[state=closed]:animate-overlay-hide',
      className
    )}
    {...props}
  />
))
SheetOverlay.displayName = 'SheetOverlay'

// ─── Content (right side) ─────────────────────────────────────────────────────
const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <SheetPortal>
    <SheetOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Positioning: fixed, full height, anchored to the right
        'fixed right-0 top-0 z-50 h-full',
        // Width — comfortable for task detail
        'w-full max-w-[480px]',
        // Aesthetic — clean white, sharp edges
        'bg-white shadow-2xl shadow-black/15',
        // Flex layout so header/body/footer stack correctly
        'flex flex-col',
        // Slide animations
        'data-[state=open]:animate-sheet-slide-in',
        'data-[state=closed]:animate-sheet-slide-out',
        className
      )}
      {...props}
    >
      {children}

      {/* Close button — absolute so it doesn't affect layout */}
      <SheetClose
        className="
          absolute right-5 top-5
          text-zinc-400 hover:text-black
          transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
      >
        <X size={16} strokeWidth={1.5} />
        <span className="sr-only">Close</span>
      </SheetClose>
    </DialogPrimitive.Content>
  </SheetPortal>
))
SheetContent.displayName = 'SheetContent'

// ─── Header ───────────────────────────────────────────────────────────────────
const SheetHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('px-6 pt-6 pb-4 border-b border-zinc-100 shrink-0', className)}
    {...props}
  />
)
SheetHeader.displayName = 'SheetHeader'

// ─── Body (scrollable middle) ─────────────────────────────────────────────────
const SheetBody = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex-1 overflow-y-auto px-6 py-5', className)}
    {...props}
  />
)
SheetBody.displayName = 'SheetBody'

// ─── Footer ───────────────────────────────────────────────────────────────────
const SheetFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('px-6 py-4 border-t border-zinc-100 shrink-0', className)}
    {...props}
  />
)
SheetFooter.displayName = 'SheetFooter'

// ─── Title ────────────────────────────────────────────────────────────────────
const SheetTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-sm font-semibold text-black tracking-tight pr-8', className)}
    {...props}
  />
))
SheetTitle.displayName = 'SheetTitle'

// ─── Description ─────────────────────────────────────────────────────────────
const SheetDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-xs text-zinc-500 mt-0.5', className)}
    {...props}
  />
))
SheetDescription.displayName = 'SheetDescription'

export {
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetPortal,
  SheetOverlay,
  SheetContent,
  SheetHeader,
  SheetBody,
  SheetFooter,
  SheetTitle,
  SheetDescription,
}
