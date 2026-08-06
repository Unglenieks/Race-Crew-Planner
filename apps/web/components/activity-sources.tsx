"use client";

import {
  FileText,
  Link2,
  LoaderCircle,
  MessageSquare,
  Plus,
} from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { activityApi } from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function date(value: number) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value));
}

export function ActivitySources({ eventId }: { eventId: string }) {
  const data = useQuery(activityApi.list, { eventId });
  const addComment = useMutation(activityApi.addComment);
  const addSource = useMutation(activityApi.addSource);
  const [comment, setComment] = useState("");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [excerpt, setExcerpt] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    try {
      await addComment({ eventId, body: comment });
      setComment("");
    } catch {
      setError("The comment was not saved. Please try again.");
    }
  }
  async function sourceSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
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
    } catch {
      setError("The source was not saved. Check its title and link.");
    }
  }
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Activity and sources</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          <form className="grid gap-2" onSubmit={commentSubmit}>
            <label
              className="text-sm font-medium text-ink"
              htmlFor="event-comment"
            >
              Add a comment
            </label>
            <textarea
              id="event-comment"
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              maxLength={2000}
              required
              className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm"
            />
            <Button className="w-fit" type="submit" variant="secondary">
              <MessageSquare className="h-4 w-4" aria-hidden="true" />
              Save comment
            </Button>
          </form>
          <form className="grid gap-2" onSubmit={sourceSubmit}>
            <p className="text-sm font-medium text-ink">Add a source</p>
            <label className="sr-only" htmlFor="source-title">
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
            <label className="sr-only" htmlFor="source-url">
              Source link
            </label>
            <Input
              id="source-url"
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://… (optional)"
              maxLength={1000}
            />
            <textarea
              value={excerpt}
              onChange={(event) => setExcerpt(event.target.value)}
              placeholder="Quoted excerpt or context (optional)"
              maxLength={2000}
              className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm"
            />
            <Button className="w-fit" type="submit" variant="secondary">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              Save source
            </Button>
          </form>
          {error === null ? null : (
            <p className="text-sm text-danger-tx" role="alert">
              {error}
            </p>
          )}
        </CardContent>
      </Card>
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
                    <p className="text-sm text-ink">{item.message}</p>
                    <p className="text-xs text-muted">
                      {item.actorId} · {date(item.createdAt)}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
      {data.sources.length === 0 ? null : (
        <Card>
          <CardHeader>
            <CardTitle>Sources</CardTitle>
          </CardHeader>
          <CardContent>
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
                    <p className="mt-1 text-sm text-muted">{source.excerpt}</p>
                  )}
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
