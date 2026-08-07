"use client";

import { FileUp, LoaderCircle, Trash2 } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  filesApi,
  itineraryApi,
  recordsApi,
  workApi,
  type EventRole,
} from "@/lib/events-api";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";

const acceptedTypes = ".pdf,image/jpeg,image/png,image/webp,text/plain";

function readableSize(size: number) {
  return size < 1024 * 1024
    ? `${Math.ceil(size / 1024)} KB`
    : `${(size / (1024 * 1024)).toFixed(1)} MB`;
}

function date(value: number) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );
}

export function FilesLibrary({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const files = useQuery(filesApi.list, { eventId });
  const records = useQuery(recordsApi.list, { eventId });
  const work = useQuery(workApi.list, { eventId });
  const movements = useQuery(itineraryApi.list, { eventId });
  const generateUploadUrl = useMutation(filesApi.generateUploadUrl);
  const save = useMutation(filesApi.save);
  const remove = useMutation(filesApi.remove);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const canRemove = role === "owner" || role === "manager";

  async function upload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (file === null) return;
    setError(null);
    if (file.size === 0 || file.size > 10 * 1024 * 1024) {
      setError("Choose a file between 1 byte and 10 MB.");
      return;
    }
    setIsUploading(true);
    try {
      const uploadUrl = await generateUploadUrl({ eventId });
      const response = await fetch(uploadUrl, { method: "POST", body: file });
      if (!response.ok) throw new Error("Upload failed");
      const { storageId } = (await response.json()) as { storageId?: string };
      if (storageId === undefined) throw new Error("Upload failed");
      const [targetType, targetId] = target.split(":");
      await save({
        eventId,
        storageId,
        name: file.name,
        ...(targetId === undefined
          ? {}
          : targetType === "record"
            ? { recordId: targetId }
            : targetType === "work"
              ? { workItemId: targetId }
              : { itineraryItemId: targetId }),
      });
      setFile(null);
      setTarget("");
      const input = document.getElementById(
        "event-file",
      ) as HTMLInputElement | null;
      if (input !== null) input.value = "";
    } catch {
      setError("The file was not stored. Check your connection and try again.");
    } finally {
      setIsUploading(false);
    }
  }

  async function deleteFile(fileId: string) {
    setError(null);
    try {
      await remove({ eventId, fileId });
    } catch {
      setError("The file could not be removed. It is still available.");
    }
  }

  if (
    files === undefined ||
    records === undefined ||
    work === undefined ||
    movements === undefined
  )
    return (
      <p className="flex items-center text-sm text-muted" role="status">
        <LoaderCircle
          className="mr-2 h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        Loading files…
      </p>
    );

  return (
    <div className="grid items-start gap-4 lg:grid-cols-[.75fr_1.25fr]">
      <Card>
        <CardHeader>
          <CardTitle>Add evidence</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-3" onSubmit={upload}>
            <p className="text-sm leading-relaxed text-muted">
              PDF, image, or text file up to 10 MB. Uploads need a connection
              and are not queued.
            </p>
            <label
              className="grid gap-1 text-sm font-medium text-ink"
              htmlFor="event-file"
            >
              File
              <input
                id="event-file"
                type="file"
                accept={acceptedTypes}
                required
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label
              className="grid gap-1 text-sm font-medium text-ink"
              htmlFor="file-record"
            >
              Attach to
              <select
                id="file-record"
                className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
                value={target}
                onChange={(event) => setTarget(event.target.value)}
              >
                <option value="">Event library only</option>
                {records.map((record) => (
                  <option key={record._id} value={`record:${record._id}`}>
                    Record: {record.name}
                  </option>
                ))}
                {work.map((item) => (
                  <option key={item._id} value={`work:${item._id}`}>
                    Work: {item.title}
                  </option>
                ))}
                {movements.map((item) => (
                  <option key={item._id} value={`movement:${item._id}`}>
                    Movement: {item.title}
                  </option>
                ))}
              </select>
            </label>
            <Button
              className="w-fit"
              type="submit"
              disabled={file === null || isUploading}
            >
              {isUploading ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <FileUp className="h-4 w-4" aria-hidden="true" />
              )}
              {isUploading ? "Uploading…" : "Store file"}
            </Button>
          </form>
          {error === null ? null : (
            <Banner className="mt-4" variant="danger" role="alert">
              {error}
            </Banner>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Files library</CardTitle>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <EmptyState
              title="No files yet"
              description="Attach a document or photo to keep evidence with this event."
            />
          ) : (
            <ul className="grid gap-3">
              {files.map((item) => (
                <li
                  key={item._id}
                  className="flex items-center justify-between gap-3 border-b border-line pb-3 last:border-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium text-ink">
                      {item.url === null ? (
                        item.name
                      ) : (
                        <a
                          className="underline"
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.name}
                        </a>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {item.contentType} · {readableSize(item.size)} ·{" "}
                      {date(item.createdAt)}
                      {item.recordId !== undefined
                        ? ` · Record: ${records.find((record) => record._id === item.recordId)?.name ?? "Record"}`
                        : item.workItemId !== undefined
                          ? ` · Work: ${work.find((entry) => entry._id === item.workItemId)?.title ?? "Work item"}`
                          : item.itineraryItemId !== undefined
                            ? ` · Movement: ${movements.find((entry) => entry._id === item.itineraryItemId)?.title ?? "Movement"}`
                            : " · Event"}
                    </p>
                  </div>
                  {canRemove ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label={`Remove ${item.name}`}
                      onClick={() => void deleteFile(item._id)}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      Remove
                    </Button>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
