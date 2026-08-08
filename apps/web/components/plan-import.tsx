"use client";

import { FileUp, LoaderCircle, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { Banner } from "@/components/ui/banner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  filesApi,
  planImportsApi,
  recordsApi,
  type EventRole,
  type PlanImportRow,
} from "@/lib/events-api";
import {
  parseDelimited,
  parseSchedulePdf,
  parseSpreadsheet,
  stageTabularRows,
  type ParsedImportRow,
} from "@/lib/plan-import";

type Drafts = Record<string, PlanImportRow>;
type StagedRow = Omit<PlanImportRow, "_id" | "importedMovementId">;

function sourceKind(file: File) {
  const name = file.name.toLocaleLowerCase();
  if (name.endsWith(".pdf")) return "pdf" as const;
  if (name.endsWith(".xlsx")) return "xlsx" as const;
  if (name.endsWith(".csv") || name.endsWith(".tsv")) return "csv" as const;
  return undefined;
}

function rowInput(row: PlanImportRow | ParsedImportRow): StagedRow {
  if (!("_id" in row)) return row;
  const input = { ...row } as Partial<PlanImportRow>;
  delete input._id;
  delete input.importedMovementId;
  return input as StagedRow;
}

function reviewedIssues(row: PlanImportRow): PlanImportRow["issues"] {
  const issues = row.issues.filter(
    (issue) => !["description", "date", "time", "place"].includes(issue.field),
  );
  if (row.description.trim().length === 0)
    issues.push({
      severity: "error",
      field: "description",
      message: "A movement description is required.",
    });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(row.normalizedDate ?? ""))
    issues.push({
      severity: "error",
      field: "date",
      message: "A valid ISO date is required.",
    });
  if (!/^\d{2}:\d{2}$/.test(row.normalizedTime ?? ""))
    issues.push({
      severity: "error",
      field: "time",
      message: "A valid start time is required.",
    });
  if (
    row.proposedMovementType === "range" &&
    !/^\d{2}:\d{2}$/.test(row.normalizedEndTime ?? "")
  )
    issues.push({
      severity: "error",
      field: "time",
      message: "A range requires an end time.",
    });
  if ((row.placeText ?? "").trim().length === 0)
    issues.push({
      severity: "warning",
      field: "place",
      message:
        "No place was supplied; this movement will be imported without a location.",
    });
  return issues;
}

function IssueBadge({ row }: { row: PlanImportRow }) {
  const errors = row.issues.filter((issue) => issue.severity === "error");
  const warnings = row.issues.filter((issue) => issue.severity === "warning");
  if (errors.length > 0)
    return (
      <Badge
        variant="danger"
        title={errors.map((issue) => issue.message).join(" ")}
      >
        {errors.length} error{errors.length === 1 ? "" : "s"}
      </Badge>
    );
  if (warnings.length > 0)
    return (
      <Badge
        variant={row.warningsAccepted ? "success" : "warning"}
        title={warnings.map((issue) => issue.message).join(" ")}
      >
        {row.warningsAccepted
          ? "Warnings accepted"
          : `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`}
      </Badge>
    );
  return <Badge variant="success">Ready</Badge>;
}

export function PlanImport({
  eventId,
  role,
}: {
  eventId: string;
  role: EventRole;
}) {
  const canManage = role === "owner" || role === "manager";
  const records = useQuery(recordsApi.list, { eventId });
  const imports = useQuery(planImportsApi.list, { eventId });
  const generateUploadUrl = useMutation(filesApi.generateUploadUrl);
  const saveFile = useMutation(filesApi.save);
  const stage = useMutation(planImportsApi.stage);
  const updateRow = useMutation(planImportsApi.updateRow);
  const commit = useMutation(planImportsApi.commit);
  const rollback = useMutation(planImportsApi.rollback);
  const [selectedImportId, setSelectedImportId] = useState<string | null>(null);
  const effectiveImportId = selectedImportId ?? imports?.[0]?._id ?? null;
  const selected = useQuery(
    planImportsApi.get,
    effectiveImportId === null
      ? "skip"
      : { eventId, importId: effectiveImportId },
  );
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [pasted, setPasted] = useState("");
  const [isStaging, setIsStaging] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isCommitting, setIsCommitting] = useState(false);
  const [isRollingBack, setIsRollingBack] = useState(false);
  const [drafts, setDrafts] = useState<Drafts>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const rows = useMemo(
    () => (selected?.rows ?? []).map((row) => drafts[row._id] ?? row),
    [drafts, selected?.rows],
  );
  const errors = rows.filter((row) =>
    row.issues.some((issue) => issue.severity === "error"),
  );
  const unacceptedWarnings = rows.filter(
    (row) =>
      row.issues.some((issue) => issue.severity === "warning") &&
      !row.warningsAccepted,
  );

  function patchRow(row: PlanImportRow, patch: Partial<PlanImportRow>) {
    const next = { ...row, ...patch };
    next.issues = reviewedIssues(next);
    if (next.issues.some((issue) => issue.severity === "warning"))
      next.warningsAccepted = false;
    setDrafts((current) => ({ ...current, [row._id]: next }));
  }

  async function storeSource(file: File) {
    const uploadUrl = await generateUploadUrl({ eventId });
    const response = await fetch(uploadUrl, { method: "POST", body: file });
    if (!response.ok) throw new Error("Upload failed");
    const { storageId } = (await response.json()) as { storageId?: string };
    if (storageId === undefined) throw new Error("Upload failed");
    return await saveFile({ eventId, storageId, name: file.name });
  }

  async function stageFile() {
    if (sourceFile === null || records === undefined) return;
    const kind = sourceKind(sourceFile);
    if (kind === undefined) {
      setError("Choose a PDF, CSV, TSV, or XLSX file.");
      return;
    }
    setError(null);
    setMessage(null);
    setIsStaging(true);
    try {
      const parsed =
        kind === "pdf"
          ? await parseSchedulePdf(sourceFile, records)
          : kind === "xlsx"
            ? stageTabularRows(await parseSpreadsheet(sourceFile), records)
            : stageTabularRows(
                parseDelimited(
                  await sourceFile.text(),
                  sourceFile.name.toLocaleLowerCase().endsWith(".tsv")
                    ? "\t"
                    : ",",
                ),
                records,
              );
      if (parsed.rows.length === 0)
        throw new Error("No schedule rows were found in that source.");
      const sourceFileId = await storeSource(sourceFile);
      const importId = await stage({
        eventId,
        sourceKind: kind,
        sourceName: sourceFile.name,
        sourceFileId,
        detectedSections: parsed.detectedSections,
        rows: parsed.rows.map(rowInput),
      });
      setSelectedImportId(importId);
      setSourceFile(null);
      const input = document.getElementById(
        "plan-import-file",
      ) as HTMLInputElement | null;
      if (input !== null) input.value = "";
      setMessage(
        `Staged ${parsed.rows.length} rows. Review the grid before committing.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The source could not be staged.",
      );
    } finally {
      setIsStaging(false);
    }
  }

  async function stagePaste() {
    if (records === undefined) return;
    setError(null);
    setMessage(null);
    setIsStaging(true);
    try {
      const parsed = stageTabularRows(
        parseDelimited(pasted, pasted.includes("\t") ? "\t" : ","),
        records,
      );
      if (parsed.rows.length === 0)
        throw new Error("Paste a header row and at least one schedule row.");
      const importId = await stage({
        eventId,
        sourceKind: "pasted",
        sourceName: "Pasted tabular data",
        detectedSections: [],
        rows: parsed.rows.map(rowInput),
      });
      setSelectedImportId(importId);
      setPasted("");
      setMessage(
        `Staged ${parsed.rows.length} rows. Review the grid before committing.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The pasted data could not be staged.",
      );
    } finally {
      setIsStaging(false);
    }
  }

  async function saveGrid() {
    if (effectiveImportId === null || Object.keys(drafts).length === 0) return;
    setError(null);
    setIsSaving(true);
    try {
      await Promise.all(
        Object.values(drafts).map((row) =>
          updateRow({
            eventId,
            importId: effectiveImportId,
            rowId: row._id,
            ...rowInput(row),
          }),
        ),
      );
      setDrafts({});
      setMessage("Grid changes saved.");
    } catch {
      setError(
        "The grid changes could not be saved. Your import is still staged.",
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function commitImport() {
    if (effectiveImportId === null) return;
    setError(null);
    setIsCommitting(true);
    try {
      const result = await commit({ eventId, importId: effectiveImportId });
      setMessage(
        `Imported ${result.movementCount} movements. This import can be rolled back from this screen.`,
      );
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The reviewed movements could not be imported.",
      );
    } finally {
      setIsCommitting(false);
    }
  }

  async function rollbackImport() {
    if (effectiveImportId === null) return;
    setError(null);
    setIsRollingBack(true);
    try {
      const result = await rollback({ eventId, importId: effectiveImportId });
      setMessage(
        `Rolled back ${result.movementCount} imported movements. They remain archived for audit and recovery.`,
      );
    } catch {
      setError("This import could not be rolled back.");
    } finally {
      setIsRollingBack(false);
    }
  }

  if (!canManage) {
    return (
      <Banner variant="danger">
        Only event owners and managers can stage or commit a plan import.
      </Banner>
    );
  }

  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Stage a plan source</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 lg:grid-cols-2">
          <div className="grid gap-3">
            <p className="text-sm text-muted">
              PDF text layers are parsed locally in this browser. OCR is
              deliberately not used; scanned documents need an explicit
              privacy/vendor decision before support is added.
            </p>
            <label
              className="grid gap-1 text-sm font-medium text-ink"
              htmlFor="plan-import-file"
            >
              PDF, CSV, TSV, or XLSX
              <input
                id="plan-import-file"
                type="file"
                accept=".pdf,.csv,.tsv,.xlsx"
                onChange={(event) =>
                  setSourceFile(event.target.files?.[0] ?? null)
                }
              />
            </label>
            <Button
              className="w-fit"
              type="button"
              onClick={() => void stageFile()}
              disabled={sourceFile === null || isStaging}
            >
              {isStaging ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <FileUp className="h-4 w-4" aria-hidden="true" />
              )}
              {isStaging ? "Staging…" : "Store and stage file"}
            </Button>
          </div>
          <div className="grid gap-2">
            <label
              className="grid gap-1 text-sm font-medium text-ink"
              htmlFor="plan-import-paste"
            >
              Paste tabular data
              <textarea
                id="plan-import-paste"
                className="min-h-28 rounded-lg border border-line bg-card p-3 font-mono text-xs"
                placeholder="Date,Time,Location,Description,Personnel"
                value={pasted}
                onChange={(event) => setPasted(event.target.value)}
              />
            </label>
            <Button
              className="w-fit"
              type="button"
              variant="secondary"
              onClick={() => void stagePaste()}
              disabled={pasted.trim().length === 0 || isStaging}
            >
              Stage pasted rows
            </Button>
          </div>
        </CardContent>
      </Card>
      {error === null ? null : (
        <Banner variant="danger" role="alert">
          {error}
        </Banner>
      )}
      {message === null ? null : (
        <Banner variant="success" role="status">
          {message}
        </Banner>
      )}
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Review grid</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Rows stay separate from the live plan until all errors are fixed
                and every remaining warning is accepted.
              </p>
            </div>
            {imports === undefined ? null : (
              <select
                aria-label="Import session"
                className="rounded-lg border border-line bg-card px-3 py-2 text-sm"
                value={effectiveImportId ?? ""}
                onChange={(event) => {
                  setDrafts({});
                  setSelectedImportId(event.target.value || null);
                }}
              >
                <option value="">Choose an import</option>
                {imports.map((item) => (
                  <option key={item._id} value={item._id}>
                    {item.sourceName} · {item.status}
                  </option>
                ))}
              </select>
            )}
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {selected === undefined || effectiveImportId === null ? (
            <p className="text-sm text-muted">
              Choose or stage a source to review its rows.
            </p>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="neutral">{rows.length} staged rows</Badge>
                  <Badge variant={errors.length > 0 ? "danger" : "success"}>
                    {errors.length} errors
                  </Badge>
                  <Badge
                    variant={
                      unacceptedWarnings.length > 0 ? "warning" : "success"
                    }
                  >
                    {unacceptedWarnings.length} warnings awaiting acceptance
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selected.status === "reviewing" ? (
                    <>
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => void saveGrid()}
                        disabled={Object.keys(drafts).length === 0 || isSaving}
                      >
                        {isSaving ? "Saving…" : "Save grid edits"}
                      </Button>
                      <Button
                        type="button"
                        onClick={() => void commitImport()}
                        disabled={
                          errors.length > 0 ||
                          unacceptedWarnings.length > 0 ||
                          isCommitting
                        }
                      >
                        {isCommitting ? "Importing…" : "Commit reviewed rows"}
                      </Button>
                    </>
                  ) : null}
                  {selected.status === "committed" ? (
                    <Button
                      type="button"
                      variant="danger"
                      onClick={() => void rollbackImport()}
                      disabled={isRollingBack}
                    >
                      {isRollingBack ? (
                        "Rolling back…"
                      ) : (
                        <>
                          <RotateCcw className="h-4 w-4" aria-hidden="true" />
                          Rollback import
                        </>
                      )}
                    </Button>
                  ) : null}
                </div>
              </div>
              {selected.detectedSections.length === 0 ? null : (
                <Banner variant="warning">
                  <b>Detected but not imported:</b>{" "}
                  {selected.detectedSections.join(", ")}. Venue, contact, and
                  logistics imports are not implemented, so these sections
                  remain in the original source file.
                </Banner>
              )}
              {selected.sourceFileId === undefined ? null : (
                <p className="text-sm text-muted">
                  Original source is retained in{" "}
                  <Link className="underline" href={`/events/${eventId}/files`}>
                    Files &amp; sources
                  </Link>
                  ; each row keeps its source page or row reference.
                </p>
              )}
              <div className="overflow-x-auto rounded-lg border border-line">
                <table className="min-w-[1180px] w-full border-collapse text-left text-sm">
                  <thead className="bg-soft text-xs uppercase tracking-wide text-muted">
                    <tr>
                      <th className="p-2">Source</th>
                      <th className="p-2">Day / date</th>
                      <th className="p-2">Time</th>
                      <th className="p-2">Place / venue</th>
                      <th className="p-2">Description</th>
                      <th className="p-2">Personnel</th>
                      <th className="p-2">Type / tags</th>
                      <th className="p-2">Review</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr
                        key={row._id}
                        className="border-t border-line align-top"
                      >
                        <td className="p-2 text-xs text-muted">
                          {row.sourcePage === undefined
                            ? `Row ${row.sourceRow}`
                            : `Page ${row.sourcePage}, row ${row.sourceRow}`}
                        </td>
                        <td className="p-2">
                          <span className="mb-1 block text-xs text-muted">
                            {row.operationalDay ?? "No day"} ·{" "}
                            {row.fieldConfidence.date}%
                          </span>
                          <Input
                            aria-label={`Date for row ${row.sourceRow}`}
                            value={row.normalizedDate ?? ""}
                            onChange={(event) =>
                              patchRow(row, {
                                normalizedDate: event.target.value || undefined,
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <span className="mb-1 block text-xs text-muted">
                            {row.fieldConfidence.time}%
                          </span>
                          <div className="flex gap-1">
                            <Input
                              aria-label={`Start time for row ${row.sourceRow}`}
                              value={row.normalizedTime ?? ""}
                              onChange={(event) =>
                                patchRow(row, {
                                  normalizedTime:
                                    event.target.value || undefined,
                                })
                              }
                            />
                            {row.proposedMovementType === "range" ? (
                              <Input
                                aria-label={`End time for row ${row.sourceRow}`}
                                value={row.normalizedEndTime ?? ""}
                                onChange={(event) =>
                                  patchRow(row, {
                                    normalizedEndTime:
                                      event.target.value || undefined,
                                  })
                                }
                              />
                            ) : null}
                          </div>
                        </td>
                        <td className="p-2">
                          <Input
                            aria-label={`Place for row ${row.sourceRow}`}
                            value={row.placeText ?? ""}
                            onChange={(event) =>
                              patchRow(row, {
                                placeText: event.target.value || undefined,
                                proposedVenueId: undefined,
                              })
                            }
                          />
                          <select
                            aria-label={`Venue match for row ${row.sourceRow}`}
                            className="mt-1 w-full rounded border border-line bg-card p-1 text-xs"
                            value={row.proposedVenueId ?? ""}
                            onChange={(event) =>
                              patchRow(row, {
                                proposedVenueId:
                                  event.target.value || undefined,
                              })
                            }
                          >
                            <option value="">No venue match</option>
                            {(records ?? []).map((record) => (
                              <option key={record._id} value={record._id}>
                                {record.name}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="p-2">
                          <Input
                            aria-label={`Description for row ${row.sourceRow}`}
                            value={row.description}
                            onChange={(event) =>
                              patchRow(row, { description: event.target.value })
                            }
                          />
                          <span className="mt-1 block text-xs text-muted">
                            {row.fieldConfidence.description}% confidence
                          </span>
                        </td>
                        <td className="p-2">
                          <p>{row.rawPersonnel ?? "—"}</p>
                          <span className="text-xs text-muted">
                            {row.resolvedAssignments.length > 0
                              ? `Resolved: ${row.resolvedAssignments.join(", ")}`
                              : `${row.fieldConfidence.personnel}% confidence`}
                          </span>
                        </td>
                        <td className="p-2">
                          <select
                            aria-label={`Movement type for row ${row.sourceRow}`}
                            className="rounded border border-line bg-card p-1 text-xs"
                            value={row.proposedMovementType}
                            onChange={(event) =>
                              patchRow(row, {
                                proposedMovementType: event.target
                                  .value as PlanImportRow["proposedMovementType"],
                              })
                            }
                          >
                            {[
                              "exact",
                              "approximate",
                              "range",
                              "allDay",
                              "unspecified",
                            ].map((type) => (
                              <option key={type} value={type}>
                                {type}
                              </option>
                            ))}
                          </select>
                          <Input
                            className="mt-1"
                            aria-label={`Tags for row ${row.sourceRow}`}
                            value={row.proposedTags.join(", ")}
                            onChange={(event) =>
                              patchRow(row, {
                                proposedTags: event.target.value
                                  .split(",")
                                  .map((tag) => tag.trim())
                                  .filter(Boolean),
                              })
                            }
                          />
                        </td>
                        <td className="p-2">
                          <IssueBadge row={row} />
                          {row.issues.length === 0 ? null : (
                            <ul className="mt-1 max-w-52 list-disc pl-4 text-xs text-muted">
                              {row.issues.map((issue, index) => (
                                <li key={`${issue.field}-${index}`}>
                                  {issue.message}
                                </li>
                              ))}
                            </ul>
                          )}
                          {row.issues.some(
                            (issue) => issue.severity === "warning",
                          ) && selected.status === "reviewing" ? (
                            <label className="mt-2 flex items-center gap-1 text-xs">
                              <input
                                type="checkbox"
                                checked={row.warningsAccepted}
                                onChange={(event) =>
                                  patchRow(row, {
                                    warningsAccepted: event.target.checked,
                                  })
                                }
                              />
                              Accept warnings
                            </label>
                          ) : null}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
