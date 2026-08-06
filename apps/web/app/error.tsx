"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Route-level backstop so an unexpected client failure keeps the application
 * styling and offers a retry instead of the framework error screen. Error
 * details are logged rather than rendered because they can echo backend
 * payloads.
 */
export default function RouteError({
  error,
  reset,
}: Readonly<{ error: Error & { digest?: string }; reset: () => void }>) {
  useEffect(() => {
    console.error("Unhandled route error", error);
  }, [error]);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-7 py-16">
      <Card>
        <CardHeader>
          <CardTitle>Something went wrong</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          <p className="text-sm leading-relaxed text-muted">
            This page stopped loading before it finished. Nothing you entered
            was saved. Try again, and report the problem if it repeats.
          </p>
          <Button variant="primary" className="w-fit" onClick={reset}>
            Try again
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}
