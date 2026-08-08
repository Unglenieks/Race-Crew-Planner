"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Button } from "@/components/ui/button";

const focusableSelector =
  'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

/** A modal confirmation step for actions that remove access or operational data. */
export function ConfirmDestructiveAction({
  title,
  description,
  confirmLabel = "Confirm",
  isPending = false,
  onCancel,
  onConfirm,
}: {
  title: string;
  description: string;
  confirmLabel?: string;
  isPending?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const portalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const isPendingRef = useRef(isPending);
  const onCancelRef = useRef(onCancel);

  useEffect(() => {
    isPendingRef.current = isPending;
    onCancelRef.current = onCancel;
  }, [isPending, onCancel]);
  useEffect(() => {
    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    cancelRef.current?.focus();

    const inertElements = Array.from(document.body.children)
      .filter(
        (element): element is HTMLElement =>
          element instanceof HTMLElement && element !== portalRef.current,
      )
      .map((element) => ({ element, inert: element.inert }));
    inertElements.forEach(({ element }) => {
      element.inert = true;
    });

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isPendingRef.current) {
        event.preventDefault();
        onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const dialog = dialogRef.current;
      if (dialog === null) return;
      const focusable = Array.from(
        dialog.querySelectorAll<HTMLElement>(focusableSelector),
      );
      const first = focusable[0];
      const last = focusable.at(-1);
      if (first === undefined || last === undefined) return;
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      inertElements.forEach(({ element, inert }) => {
        element.inert = inert;
      });
      if (previouslyFocusedRef.current?.isConnected) {
        previouslyFocusedRef.current.focus();
      }
    };
  }, []);

  if (typeof document === "undefined") return null;
  return createPortal(
    <div
      ref={portalRef}
      className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isPending) onCancel();
      }}
    >
      <section
        ref={dialogRef}
        className="w-full max-w-md rounded-xl border border-danger-tx bg-card p-5 shadow-xl"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="confirm-destructive-title"
        aria-describedby="confirm-destructive-description"
      >
        <h2
          id="confirm-destructive-title"
          className="text-lg font-semibold text-ink"
        >
          {title}
        </h2>
        <p
          id="confirm-destructive-description"
          className="mt-2 text-sm leading-relaxed text-muted"
        >
          {description}
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button
            ref={cancelRef}
            type="button"
            variant="secondary"
            disabled={isPending}
            onClick={onCancel}
          >
            Keep it
          </Button>
          <Button
            type="button"
            variant="danger"
            disabled={isPending}
            onClick={onConfirm}
          >
            {isPending ? (
              <LoaderCircle
                className="h-4 w-4 animate-spin"
                aria-hidden="true"
              />
            ) : null}
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </section>
    </div>,
    document.body,
  );
}
