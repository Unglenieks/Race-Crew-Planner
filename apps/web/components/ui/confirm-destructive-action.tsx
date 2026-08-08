"use client";

import { LoaderCircle } from "lucide-react";
import { useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";

/** A focused confirmation step for actions that remove access or operational data. */
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

  useEffect(() => cancelRef.current?.focus(), []);

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-ink/45 p-4"
      role="presentation"
    >
      <section
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
    </div>
  );
}
