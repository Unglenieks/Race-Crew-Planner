"use client";

import { FileUp, LoaderCircle, Trash2 } from "lucide-react";
import { FormEvent, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  filesApi,
  itineraryApi,
  recordsApi,
  workApi,
  type EventRole,
  type ItineraryItem,
} from "@/lib/events-api";
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";
import { calendarDay, displayMovementTime } from "@/lib/timing";
import { ConfirmDestructiveAction } from "@/components/ui/confirm-destructive-action";

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

function movementTargetLabel(item: ItineraryItem) {
  return `Movement · ${new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(
    new Date(`${calendarDay(item)}T00:00:00Z`),
  )} · ${displayMovementTime(item)} · ${item.title}`;
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
  const fileInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [target, setTarget] = useState("");
  const [targetQuery, setTargetQuery] = useState("");
  const [isUploading, setIsUploading] = useState(false);
  const [isRemoving, setIsRemoving] = useState(false);
  const [removeTarget, setRemoveTarget] = useState<{
    id: string;
    name: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canManageFiles = role === "owner" || role === "manager";
  const selectedTargetLabel = useMemo(() => {
    if (target === "") return "Event library only";
    const [type, id] = target.split(":");
    if (type === "record")
      return records?.find((record) => record._id === id)?.name;
    if (type === "work") return work?.find((item) => item._id === id)?.title;
    const movement = movements?.find((item) => item._id === id);
    return movement === undefined ? undefined : movementTargetLabel(movement);
  }, [movements, records, target, work]);
  const normalizedTargetQuery = targetQuery.trim().toLocaleLowerCase();
  const filteredRecords = (records ?? []).filter((record) =>
    record.name.toLocaleLowerCase().includes(normalizedTargetQuery),
  );
  const filteredWork = (work ?? []).filter((item) =>
    item.title.toLocaleLowerCase().includes(normalizedTargetQuery),
  );
  const filteredMovements = (movements ?? []).filter((item) =>
    movementTargetLabel(item)
      .toLocaleLowerCase()
      .includes(normalizedTargetQuery),
  );

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
      setTargetQuery("");
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
    setIsRemoving(true);
    try {
      await remove({ eventId, fileId });
      setRemoveTarget(null);
    } catch {
      setError("The file could not be removed. It is still available.");
    } finally {
      setIsRemoving(false);
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
      {removeTarget === null ? null : (
        <ConfirmDestructiveAction
          title="Remove file?"
          description={`Remove ${removeTarget.name} from this event. This evidence file will no longer be available from the library.`}
          confirmLabel="Remove file"
          isPending={isRemoving}
          onCancel={() => setRemoveTarget(null)}
          onConfirm={() => void deleteFile(removeTarget.id)}
        />
      )}
      {canManageFiles ? (
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
              <div className="grid gap-2">
                <input
                  id="event-file"
                  ref={fileInput}
                  type="file"
                  accept={acceptedTypes}
                  required
                  className="sr-only"
                  aria-label="Choose file"
                  onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="secondary"
                  className="w-fit"
                  onClick={() => fileInput.current?.click()}
                >
                  Choose file
                </Button>
                <p className="text-sm text-muted" aria-live="polite">
                  {file === null ? "No file chosen" : file.name}
                </p>
              </div>
              <fieldset className="grid gap-2">
                <legend className="text-sm font-medium text-ink">
                  Attach to
                </legend>
                <p className="text-xs text-muted" id="file-target-help">
                  Search records, work, or movements. Movement results include
                  their operational date and time.
                </p>
                <label className="sr-only" htmlFor="file-target-search">
                  Search attachment targets
                </label>
                <Input
                  id="file-target-search"
                  value={targetQuery}
                  onChange={(event) => setTargetQuery(event.target.value)}
                  placeholder="Search attachment targets"
                  aria-describedby="file-target-help"
                  autoComplete="off"
                />
                <Button
                  type="button"
                  size="sm"
                  variant={target === "" ? "primary" : "secondary"}
                  className="w-fit"
                  aria-pressed={target === ""}
                  onClick={() => setTarget("")}
                >
                  Event library only
                </Button>
                {normalizedTargetQuery.length === 0 ? (
                  <p className="text-xs text-muted">
                    Start typing to find an attachment target.
                  </p>
                ) : (
                  <div
                    className="grid max-h-60 gap-3 overflow-auto rounded-lg border border-line p-2"
                    aria-live="polite"
                  >
                    {[
                      [
                        "Records",
                        filteredRecords.map((record) => ({
                          id: `record:${record._id}`,
                          label: `Record · ${record.name}`,
                        })),
                      ],
                      [
                        "Work",
                        filteredWork.map((item) => ({
                          id: `work:${item._id}`,
                          label: `Work · ${item.title}`,
                        })),
                      ],
                      [
                        "Movements",
                        filteredMovements.map((item) => ({
                          id: `movement:${item._id}`,
                          label: movementTargetLabel(item),
                        })),
                      ],
                    ].map(([group, options]) => {
                      const targets = options as {
                        id: string;
                        label: string;
                      }[];
                      return targets.length === 0 ? null : (
                        <div key={group as string} className="grid gap-1">
                          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
                            {group as string}
                          </p>
                          {targets.map((option) => (
                            <Button
                              key={option.id}
                              type="button"
                              variant={
                                target === option.id ? "primary" : "ghost"
                              }
                              className="h-auto min-h-11 justify-start whitespace-normal text-left"
                              aria-pressed={target === option.id}
                              onClick={() => setTarget(option.id)}
                            >
                              {option.label}
                            </Button>
                          ))}
                        </div>
                      );
                    })}
                    {filteredRecords.length +
                      filteredWork.length +
                      filteredMovements.length ===
                    0 ? (
                      <p className="text-sm text-muted">
                        No attachment targets match this search.
                      </p>
                    ) : null}
                  </div>
                )}
                <p className="text-xs text-muted" aria-live="polite">
                  Selected:{" "}
                  {selectedTargetLabel ?? "Attachment target unavailable"}
                </p>
              </fieldset>
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
      ) : null}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle>Files library</CardTitle>
            <Badge variant={canManageFiles ? "success" : "neutral"}>
              {canManageFiles ? "Can manage files" : "View only"}
            </Badge>
          </div>
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
                  {canManageFiles ? (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      aria-label={`Remove ${item.name}`}
                      onClick={() =>
                        setRemoveTarget({ id: item._id, name: item.name })
                      }
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
