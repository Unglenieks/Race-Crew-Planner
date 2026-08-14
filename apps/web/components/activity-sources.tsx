"use client";

import { FileText, Link2, LoaderCircle, MessageSquare } from "lucide-react";
import { FormEvent, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery } from "convex/react";
import { activityApi, type EventRole } from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function date(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ActivitySources({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const data = useQuery(activityApi.list, { eventId });
  const addComment = useMutation(activityApi.addComment);
  const addSource = useMutation(activityApi.addSource);
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSourceComposerOpen, setIsSourceComposerOpen] = useState(false);
  const [isSavingComment, setIsSavingComment] = useState(false);
  const [isSavingSource, setIsSavingSource] = useState(false);
  const canManageSources = role === "owner" || role === "manager";
  if (data === undefined)
    return (
      <p className="flex items-center text-sm text-muted" role="status">
        <LoaderCircle
          className="mr-2 h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        Loading activity…
      </p>
    );
  async function commentSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSavingComment(true);
    try {
      await addComment({ eventId, body: comment });
      setComment("");
    } catch {
      setError("The comment was not saved. Please try again.");
    } finally {
      setIsSavingComment(false);
    }
  }
  async function sourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSavingSource(true);
    try {
      await addSource({
        eventId,
        title,
        url: url || undefined,
        excerpt: excerpt || undefined,
      });
      setTitle("");
      setUrl("");
      setExcerpt("");
      setIsSourceComposerOpen(false);
    } catch {
      setError("The source was not saved. Check its title and link.");
    } finally {
      setIsSavingSource(false);
    }
  }
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[.65fr_1.35fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add a comment</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form className="grid gap-2" onSubmit={commentSubmit}>
            <label
              className="text-sm font-medium text-ink"
              htmlFor="event-comment"
            >
              Comment
            </label>
            <textarea
              id="event-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              required
              className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm"
            />
            <Button
              className="w-fit"
              type="submit"
              variant="secondary"
              disabled={isSavingComment || comment.trim().length === 0}
            >
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              {isSavingComment ? "Saving comment…" : "Save comment"}
            </Button>
          </form>
          {error === null ? null : (
            <p className="text-sm text-danger-tx" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
      <div className="grid gap-4">
        <Card>
          <CardHeader>
            <CardTitle>Recent activity</CardTitle>
          </CardHeader>
          <CardContent>
            {data.activity.length === 0 ? (
              <p className="text-sm text-muted">No activity recorded yet.</p>
            ) : (
              <ol className="grid gap-3">
                {data.activity.map((item) => (
                  <li
                    key={item._id}
                    className="flex gap-2 border-b border-line pb-3 last:border-0"
                  >
                    <FileText
                      className="mt-0.5 h-4 w-4 text-green-ink"
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm text-ink">
                        {item.href === undefined ? (
                          item.message
                        ) : (
                          <Link
                            className="font-medium underline"
                            href={item.href}
                          >
                            {item.message}
                          </Link>
                        )}
                      </p>
                      <p className="text-xs text-muted">
                        {item.actorName ?? "Profile pending"} ·{" "}
                        {date(item.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Comments</CardTitle>
          </CardHeader>
          <CardContent>
            {data.comments.length === 0 ? (
              <p className="text-sm text-muted">No comments saved yet.</p>
            ) : (
              <ol className="grid gap-3">
                {data.comments.map((comment) => (
                  <li
                    key={comment._id}
                    className="border-b border-line pb-3 last:border-0"
                  >
                    <p className="whitespace-pre-wrap text-sm text-ink">
                      {comment.body}
                    </p>
                    <p className="mt-1 text-xs text-muted">
                      {comment.authorName} · {date(comment.createdAt)}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <CardTitle>Sources</CardTitle>
                <p className="mt-1 text-sm text-muted">
                  References supporting the event&apos;s shared decisions.
                </p>
              </div>
              {canManageSources ? (
                <Button
                  type="button"
                  size="sm"
                  variant="secondary"
                  onClick={() => setIsSourceComposerOpen((open) => !open)}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {isSourceComposerOpen ? "Close" : "Add source"}
                </Button>
              ) : null}
            </div>
          </CardHeader>
          <CardContent className="grid gap-4">
            {canManageSources && isSourceComposerOpen ? (
              <form
                className="grid gap-2 rounded-lg border border-line p-3"
                onSubmit={sourceSubmit}
              >
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="source-title"
                >
                  Source title
                </label>
                <Input
                  id="source-title"
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Source title"
                  maxLength={160}
                  required
                />
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="source-url"
                >
                  Source link{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <Input
                  id="source-url"
                  value={url}
                  onChange={(event) => setUrl(event.target.value)}
                  placeholder="https://…"
                  maxLength={1000}
                />
                <label
                  className="text-sm font-medium text-ink"
                  htmlFor="source-excerpt"
                >
                  Context{" "}
                  <span className="font-normal text-muted">(optional)</span>
                </label>
                <textarea
                  id="source-excerpt"
                  value={excerpt}
                  onChange={(event) => setExcerpt(event.target.value)}
                  maxLength={2000}
                  className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm"
                />
                <Button
                  className="w-fit"
                  type="submit"
                  variant="secondary"
                  disabled={isSavingSource}
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  {isSavingSource ? "Saving source…" : "Save source"}
                </Button>
              </form>
            ) : null}
            {data.sources.length === 0 ? (
              <p className="text-sm text-muted">No sources saved yet.</p>
            ) : (
              <ul className="grid gap-3">
                {data.sources.map((source) => (
                  <li key={source._id}>
                    <p className="font-medium text-ink">
                      {source.url === undefined ? (
                        source.title
                      ) : (
                        <a
                          className="underline"
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {source.title}
                        </a>
                      )}
                    </p>
                    {source.excerpt === undefined ? null : (
                      <p className="mt-1 text-sm text-muted">
                        {source.excerpt}
                      </p>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
