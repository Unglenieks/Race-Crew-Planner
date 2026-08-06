"use client";

import {
  Check,
  ChevronDown,
  ChevronUp,
  FilePlus2,
  LoaderCircle,
  Pencil,
  Plus,
  Save,
  Trash2,
} from "lucide-react";
import { FormEvent, useRef, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import {
  formsApi,
  type FormField,
  type FormSubmission,
  type FormTemplate,
} from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

const fieldTypes: Array<{ value: FormField["type"]; label: string }> = [
  { value: "text", label: "Text" },
  { value: "number", label: "Number" },
  { value: "date", label: "Date" },
  { value: "select", label: "Choose one" },
  { value: "multiSelect", label: "Choose many" },
  { value: "boolean", label: "Yes / no" },
];
const starterFields: FormField[] = [
  { id: "item", label: "Item inspected", type: "text", required: true },
  { id: "passed", label: "Passed inspection", type: "boolean", required: true },
  { id: "notes", label: "Notes", type: "text", required: false },
];

function newField(existing: FormField[]): FormField {
  let index = existing.length + 1;
  while (existing.some((field) => field.id === `field_${index}`)) index += 1;
  return {
    id: `field_${index}`,
    label: "New field",
    type: "text",
    required: false,
  };
}

function TemplateBuilder({
  eventId,
  template,
  onDone,
}: {
  eventId: string;
  template?: FormTemplate;
  onDone: () => void;
}) {
  const createTemplate = useMutation(formsApi.createTemplate);
  const createVersion = useMutation(formsApi.createTemplateVersion);
  const [name, setName] = useState(template?.name ?? "Vehicle inspection");
  const [fields, setFields] = useState<FormField[]>(
    template?.fields ?? starterFields,
  );
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const updateField = (index: number, update: Partial<FormField>) =>
    setFields((current) =>
      current.map((field, currentIndex) =>
        currentIndex === index ? { ...field, ...update } : field,
      ),
    );
  const move = (index: number, direction: -1 | 1) =>
    setFields((current) => {
      const destination = index + direction;
      if (destination < 0 || destination >= current.length) return current;
      const next = [...current];
      [next[index], next[destination]] = [next[destination], next[index]];
      return next;
    });
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setWorking(true);
    try {
      if (template)
        await createVersion({
          eventId,
          templateId: template._id,
          name,
          fields,
        });
      else await createTemplate({ eventId, name, fields });
      onDone();
    } catch {
      setError(
        "The template version was not saved. Check its field names, identifiers, and choice options.",
      );
    } finally {
      setWorking(false);
    }
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {template
            ? `Edit ${template.name} · creates v${template.version + 1}`
            : "Build a form template"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-5" onSubmit={onSubmit}>
          <label
            className="grid gap-1.5 text-sm font-medium text-ink"
            htmlFor="template-name"
          >
            Template name
            <Input
              id="template-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={120}
              required
            />
          </label>
          <div className="grid gap-3">
            {fields.map((field, index) => (
              <fieldset
                key={`${field.id}-${index}`}
                className="grid gap-3 rounded-lg border border-line p-3"
              >
                <legend className="px-1 text-sm font-medium text-ink">
                  Field {index + 1}
                </legend>
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="grid gap-1 text-sm text-muted">
                    Label
                    <Input
                      value={field.label}
                      onChange={(event) =>
                        updateField(index, { label: event.target.value })
                      }
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-muted">
                    Identifier
                    <Input
                      value={field.id}
                      onChange={(event) =>
                        updateField(index, { id: event.target.value })
                      }
                      pattern="[a-z][a-z0-9_]{0,39}"
                      required
                    />
                  </label>
                  <label className="grid gap-1 text-sm text-muted">
                    Field type
                    <select
                      value={field.type}
                      onChange={(event) =>
                        updateField(index, {
                          type: event.target.value as FormField["type"],
                          options: undefined,
                        })
                      }
                      className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                    >
                      {fieldTypes.map((type) => (
                        <option key={type.value} value={type.value}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="grid gap-1 text-sm text-muted">
                    Instructions (optional)
                    <Input
                      value={field.instructions ?? ""}
                      maxLength={500}
                      onChange={(event) =>
                        updateField(index, {
                          instructions: event.target.value || undefined,
                        })
                      }
                    />
                  </label>
                </div>
                {field.type === "select" || field.type === "multiSelect" ? (
                  <label className="grid gap-1 text-sm text-muted">
                    Choices, separated by commas
                    <Input
                      value={field.options?.join(", ") ?? ""}
                      onChange={(event) =>
                        updateField(index, {
                          options: event.target.value
                            .split(",")
                            .map((option) => option.trim())
                            .filter(Boolean),
                        })
                      }
                      required
                    />
                  </label>
                ) : null}
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex items-center gap-2 text-sm text-ink">
                    <input
                      type="checkbox"
                      checked={field.required}
                      onChange={(event) =>
                        updateField(index, { required: event.target.checked })
                      }
                    />{" "}
                    Required
                  </label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                  >
                    <ChevronUp className="h-4 w-4" />
                    Move up
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => move(index, 1)}
                    disabled={index === fields.length - 1}
                  >
                    <ChevronDown className="h-4 w-4" />
                    Move down
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      setFields((current) =>
                        current.filter(
                          (_, currentIndex) => currentIndex !== index,
                        ),
                      )
                    }
                    disabled={fields.length === 1}
                  >
                    <Trash2 className="h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </fieldset>
            ))}
          </div>
          <Button
            type="button"
            variant="secondary"
            onClick={() =>
              setFields((current) => [...current, newField(current)])
            }
          >
            <Plus className="h-4 w-4" />
            Add field
          </Button>
          {error ? (
            <p className="text-sm text-danger-tx" role="alert">
              {error}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button type="submit" disabled={working}>
              {working ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <FilePlus2 className="h-4 w-4" />
              )}
              {template ? "Create new version" : "Create template"}
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={onDone}
              disabled={working}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

function SubmissionForm({
  eventId,
  template,
  draft,
}: {
  eventId: string;
  template: FormTemplate;
  draft?: FormSubmission;
}) {
  const saveDraft = useMutation(formsApi.saveDraft);
  const submit = useMutation(formsApi.submit);
  const [answers, setAnswers] = useState<Record<string, unknown>>(
    draft?.answers ?? {},
  );
  const [submissionId, setSubmissionId] = useState<string | null>(
    draft?._id ?? null,
  );
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const fields = useRef<Record<string, HTMLElement | null>>({});
  const setAnswer = (id: string, value: unknown) => {
    setAnswers((current) => ({ ...current, [id]: value }));
    setFieldErrors((current) => {
      const next = { ...current };
      delete next[id];
      return next;
    });
  };
  const validate = () => {
    const errors: Record<string, string> = {};
    for (const field of template.fields) {
      const value = answers[field.id];
      const missing =
        value === undefined ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);
      if (field.required && missing)
        errors[field.id] = "This field is required.";
    }
    return errors;
  };
  async function save() {
    setWorking(true);
    setMessage(null);
    setError(null);
    try {
      const id = await saveDraft({
        eventId,
        templateId: template._id,
        submissionId: submissionId ?? undefined,
        answers,
      });
      setSubmissionId(id);
      setMessage("Draft saved. You can return before submitting.");
      return id;
    } catch {
      setError(
        "Your draft was not saved. Correct any invalid values and try again.",
      );
      return null;
    } finally {
      setWorking(false);
    }
  }
  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const errors = validate();
    setFieldErrors(errors);
    setMessage(null);
    setError(null);
    const first = Object.keys(errors)[0];
    if (first) {
      fields.current[first]?.focus();
      return;
    }
    // Always persist the current answers first. Submitting an existing draft
    // without saving would submit whatever was stored at the last save and throw
    // away every edit made since.
    const id = await save();
    if (!id) return;
    setWorking(true);
    try {
      await submit({ eventId, submissionId: id });
      setMessage(
        "Submitted. This completed inspection retains its exact template version and field schema.",
      );
    } catch {
      setError(
        "The form could not be submitted. Your saved draft is still available.",
      );
    } finally {
      setWorking(false);
    }
  }
  const invalidCount = Object.keys(fieldErrors).length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {template.name}{" "}
          <span className="text-sm font-normal text-muted">
            v{template.version}
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form className="grid gap-4" onSubmit={onSubmit} noValidate>
          {invalidCount ? (
            <div
              className="rounded-md border border-danger-tx bg-danger-bg px-3 py-2 text-sm text-danger-tx"
              role="alert"
              aria-live="assertive"
            >
              <p>
                {invalidCount} required field
                {invalidCount === 1 ? " is" : "s are"} incomplete.
              </p>
              <ul className="mt-1 list-disc pl-5">
                {Object.keys(fieldErrors).map((id) => (
                  <li key={id}>
                    <button
                      type="button"
                      className="underline"
                      onClick={() => fields.current[id]?.focus()}
                    >
                      {template.fields.find((field) => field.id === id)?.label}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {template.fields.map((field) => (
            <div key={field.id} className="grid gap-1.5">
              <label
                className="text-sm font-medium text-ink"
                htmlFor={`form-${template._id}-${field.id}`}
              >
                {field.label}
                {field.required ? " (required)" : ""}
              </label>
              {field.instructions ? (
                <p className="text-sm text-muted">{field.instructions}</p>
              ) : null}
              {field.type === "boolean" ? (
                <select
                  ref={(element) => {
                    fields.current[field.id] = element;
                  }}
                  id={`form-${template._id}-${field.id}`}
                  value={
                    answers[field.id] === undefined
                      ? ""
                      : String(answers[field.id])
                  }
                  onChange={(event) =>
                    setAnswer(
                      field.id,
                      event.target.value === ""
                        ? undefined
                        : event.target.value === "true",
                    )
                  }
                  aria-invalid={Boolean(fieldErrors[field.id])}
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                >
                  <option value="">Choose an answer</option>
                  <option value="true">Yes</option>
                  <option value="false">No</option>
                </select>
              ) : null}
              {field.type === "select" ? (
                <select
                  ref={(element) => {
                    fields.current[field.id] = element;
                  }}
                  id={`form-${template._id}-${field.id}`}
                  value={String(answers[field.id] ?? "")}
                  onChange={(event) =>
                    setAnswer(field.id, event.target.value || undefined)
                  }
                  aria-invalid={Boolean(fieldErrors[field.id])}
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                >
                  <option value="">Choose an answer</option>
                  {field.options?.map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                </select>
              ) : null}
              {field.type === "multiSelect" ? (
                <div
                  ref={(element) => {
                    fields.current[field.id] = element;
                  }}
                  className="grid gap-2"
                  aria-invalid={Boolean(fieldErrors[field.id])}
                >
                  {field.options?.map((option) => {
                    const rawAnswer = answers[field.id];
                    const selected =
                      Array.isArray(rawAnswer) && rawAnswer.includes(option);
                    return (
                      <label
                        key={option}
                        className="flex items-center gap-2 text-sm text-ink"
                      >
                        <input
                          type="checkbox"
                          checked={selected}
                          onChange={(event) => {
                            const current = Array.isArray(rawAnswer)
                              ? rawAnswer.filter(
                                  (value): value is string =>
                                    typeof value === "string",
                                )
                              : [];
                            setAnswer(
                              field.id,
                              event.target.checked
                                ? [...current, option]
                                : current.filter((value) => value !== option),
                            );
                          }}
                        />
                        {option}
                      </label>
                    );
                  })}
                </div>
              ) : null}
              {field.type === "text" ? (
                <textarea
                  ref={(element) => {
                    fields.current[field.id] = element;
                  }}
                  id={`form-${template._id}-${field.id}`}
                  value={String(answers[field.id] ?? "")}
                  onChange={(event) => setAnswer(field.id, event.target.value)}
                  aria-invalid={Boolean(fieldErrors[field.id])}
                  className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm"
                />
              ) : null}
              {field.type === "number" || field.type === "date" ? (
                <Input
                  ref={(element) => {
                    fields.current[field.id] = element;
                  }}
                  id={`form-${template._id}-${field.id}`}
                  type={field.type}
                  value={String(answers[field.id] ?? "")}
                  onChange={(event) =>
                    setAnswer(
                      field.id,
                      event.target.value === ""
                        ? undefined
                        : field.type === "number"
                          ? Number(event.target.value)
                          : event.target.value,
                    )
                  }
                  aria-invalid={Boolean(fieldErrors[field.id])}
                />
              ) : null}
              {fieldErrors[field.id] ? (
                <p className="text-sm text-danger-tx" role="alert">
                  {fieldErrors[field.id]}
                </p>
              ) : null}
            </div>
          ))}
          {error ? (
            <p
              className="rounded-md border border-danger-tx bg-danger-bg px-3 py-2 text-sm text-danger-tx"
              role="alert"
            >
              {error}
            </p>
          ) : null}
          {message ? (
            <p
              className="rounded-md border border-green bg-soft px-3 py-2 text-sm text-green-ink"
              role="status"
            >
              {message}
            </p>
          ) : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={working}
              onClick={() => void save()}
            >
              <Save className="h-4 w-4" />
              Save draft
            </Button>
            <Button type="submit" disabled={working}>
              {working ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              Submit inspection
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

export function FormsInspections({
  eventId,
  role,
}: {
  eventId: string;
  role: "owner" | "manager" | "crew";
}) {
  const templates = useQuery(formsApi.listTemplates, { eventId });
  const submissions = useQuery(formsApi.listMySubmissions, { eventId });
  const [builder, setBuilder] = useState<FormTemplate | "new" | null>(null);
  if (templates === undefined || submissions === undefined)
    return (
      <p className="flex items-center text-sm text-muted" role="status">
        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
        Loading forms…
      </p>
    );
  const canBuild = role === "owner" || role === "manager";
  return (
    <div className="grid gap-4">
      {builder ? (
        <TemplateBuilder
          // Keying by template forces a remount when the operator switches which
          // template they are editing. Without it the builder keeps the previous
          // template's name and fields in state and would publish them as a new
          // version of a different template.
          key={builder === "new" ? "new" : builder._id}
          eventId={eventId}
          template={builder === "new" ? undefined : builder}
          onDone={() => setBuilder(null)}
        />
      ) : null}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {canBuild && !builder ? (
            <Button
              type="button"
              variant="secondary"
              onClick={() => setBuilder("new")}
            >
              <FilePlus2 className="h-4 w-4" />
              Build a template
            </Button>
          ) : null}
          {templates.length === 0 ? (
            <EmptyState
              title="No inspection templates yet"
              description="An owner or manager can build the first inspection template."
            />
          ) : (
            templates.map((template) => (
              <div key={template._id} className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  {template.isSuperseded ? (
                    <p className="text-sm font-medium text-warning-tx">
                      Superseded v{template.version}, shown because you have an
                      unfinished draft on it. Finish or discard it; new
                      inspections use the current version.
                    </p>
                  ) : (
                    <p className="text-sm text-muted">
                      Current version: v{template.version}. Submissions preserve
                      this schema.
                    </p>
                  )}
                  {canBuild && !template.isSuperseded ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      // Editing another template while the builder is open would
                      // discard unsaved field edits, so it must be closed first.
                      disabled={builder !== null}
                      onClick={() => setBuilder(template)}
                    >
                      <Pencil className="h-4 w-4" />
                      Edit template
                    </Button>
                  ) : null}
                </div>
                <SubmissionForm
                  eventId={eventId}
                  template={template}
                  draft={submissions.find(
                    (submission) =>
                      submission.status === "draft" &&
                      submission.templateId === template._id,
                  )}
                />
              </div>
            ))
          )}
        </CardContent>
      </Card>
      {submissions.length ? (
        <p className="text-sm text-muted">
          Your saved records:{" "}
          {
            submissions.filter((submission) => submission.status === "draft")
              .length
          }{" "}
          draft,{" "}
          {
            submissions.filter(
              (submission) => submission.status === "submitted",
            ).length
          }{" "}
          submitted.
        </p>
      ) : null}
    </div>
  );
}
