/**
 * Dialog — shadcn/ui style, built on @radix-ui/react-dialog.
 *
 * Animations use Tailwind custom keyframes defined in tailwind.config.ts:
 *   overlay-show / overlay-hide   — fade the backdrop
 *   dialog-show  / dialog-hide    — scale + fade the panel
 *
 * Radix exposes data-[state=open|closed] on its primitives, which we target
 * with Tailwind's arbitrary data-attribute variant:
 *   data-[state=open]:animate-dialog-show
 */
import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

const Dialog = DialogPrimitive.Root
const DialogTrigger = DialogPrimitive.Trigger
const DialogPortal = DialogPrimitive.Portal
const DialogClose = DialogPrimitive.Close

// ─── Overlay ─────────────────────────────────────────────────────────────
const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px]',
      'data-[state=open]:animate-overlay-show',
      'data-[state=closed]:animate-overlay-hide',
      className
    )}
    {...props}
  />
))
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName

// ─── Content ─────────────────────────────────────────────────────────────
const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => (
  <DialogPortal>
    <DialogOverlay />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        // Positioning
        'fixed left-1/2 top-1/2 z-50',
        '-translate-x-1/2 -translate-y-1/2',
        // Sizing
        'w-full max-w-lg',
        // Aesthetic — sharp edges, Clikaa style
        'bg-white shadow-2xl shadow-black/10',
        'p-8',
        // Animations (see tailwind.config.ts keyframes)
        'data-[state=open]:animate-dialog-show',
        'data-[state=closed]:animate-dialog-hide',
        className
      )}
      {...props}
    >
      {children}

      {/* Close button */}
      <DialogPrimitive.Close
        className="
          absolute right-5 top-5
          text-zinc-400 hover:text-black
          transition-colors duration-150
          focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
        "
      >
        <X size={16} strokeWidth={1.5} />
        <span className="sr-only">Close</span>
      </DialogPrimitive.Close>
    </DialogPrimitive.Content>
  </DialogPortal>
))
DialogContent.displayName = DialogPrimitive.Content.displayName

// ─── Header ───────────────────────────────────────────────────────────────
const DialogHeader = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('flex flex-col gap-1', className)} {...props} />
)
DialogHeader.displayName = 'DialogHeader'

// ─── Footer ───────────────────────────────────────────────────────────────
const DialogFooter = ({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex items-center justify-end gap-3 pt-4 border-t border-zinc-100', className)}
    {...props}
  />
)
DialogFooter.displayName = 'DialogFooter'

// ─── Title ────────────────────────────────────────────────────────────────
const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-black tracking-tight', className)}
    {...props}
  />
))
DialogTitle.displayName = DialogPrimitive.Title.displayName

// ─── Description ─────────────────────────────────────────────────────────
const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-zinc-500 mt-1', className)}
    {...props}
  />
))
DialogDescription.displayName = DialogPrimitive.Description.displayName

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogClose,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
}
