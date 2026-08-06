"use client";

import { Check, FilePlus2, LoaderCircle, Save } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { formsApi, type FormField, type FormTemplate } from "@/lib/events-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

const starterFields: FormField[] = [
  { id: "item", label: "Item inspected", type: "text", required: true },
  { id: "passed", label: "Passed inspection", type: "boolean", required: true },
  { id: "notes", label: "Notes", type: "text", required: false },
];

function TemplateCreator({ eventId }: { eventId: string }) {
  const createTemplate = useMutation(formsApi.createTemplate);
  const [name, setName] = useState("Vehicle inspection");
  const [error, setError] = useState<string | null>(null);
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={async (event: FormEvent<HTMLFormElement>) => {
        event.preventDefault();
        setError(null);
        try {
          await createTemplate({ eventId, name, fields: starterFields });
        } catch {
          setError(
            "The template was not created. Give it a name and try again.",
          );
        }
      }}
    >
      <label
        className="grid flex-1 gap-1.5 text-sm font-medium text-ink"
        htmlFor="template-name"
      >
        New inspection template
        <Input
          id="template-name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          maxLength={120}
          required
        />
      </label>
      <Button type="submit" variant="secondary">
        <FilePlus2 className="h-4 w-4" aria-hidden="true" />
        Create template
      </Button>
      {error === null ? null : (
        <p className="w-full text-sm text-danger-tx" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}

function SubmissionForm({
  eventId,
  template,
}: {
  eventId: string;
  template: FormTemplate;
}) {
  const saveDraft = useMutation(formsApi.saveDraft);
  const submit = useMutation(formsApi.submit);
  const [answers, setAnswers] = useState<
    Record<string, string | boolean | undefined>
  >({});
  const [submissionId, setSubmissionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [working, setWorking] = useState(false);
  const requiredMissing = template.fields.filter(
    (field) =>
      field.required &&
      (answers[field.id] === undefined || answers[field.id] === ""),
  );
  async function save() {
    setWorking(true);
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
      setError("Your draft was not saved. Please try again.");
      return null;
    } finally {
      setWorking(false);
    }
  }
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
        <form
          className="grid gap-4"
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage(null);
            if (requiredMissing.length > 0) {
              setError(
                `${requiredMissing.length} required field${requiredMissing.length === 1 ? " is" : "s are"} incomplete: ${requiredMissing.map((field) => field.label).join(", ")}.`,
              );
              return;
            }
            const id = submissionId ?? (await save());
            if (id === null) return;
            setWorking(true);
            try {
              await submit({ eventId, submissionId: id });
              setMessage(
                "Submitted. This completed inspection is preserved with its template version.",
              );
            } catch {
              setError(
                "The form could not be submitted. Your saved draft is still available.",
              );
            } finally {
              setWorking(false);
            }
          }}
        >
          {template.fields.map((field) => (
            <div key={field.id} className="grid gap-1.5">
              <label
                className="text-sm font-medium text-ink"
                htmlFor={`form-${template._id}-${field.id}`}
              >
                {field.label}
                {field.required ? " (required)" : ""}
              </label>
              {field.type === "boolean" ? (
                <select
                  id={`form-${template._id}-${field.id}`}
                  value={
                    answers[field.id] === undefined
                      ? ""
                      : String(answers[field.id])
                  }
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [field.id]:
                        event.target.value === "true"
                          ? true
                          : event.target.value === "false"
                            ? false
                            : undefined,
                    }))
                  }
                  className="min-h-11 rounded-lg border border-line bg-card px-3 text-sm"
                >
                  <option value="">Choose an answer</option>
                  <option value="true">Pass</option>
                  <option value="false">Fail</option>
                </select>
              ) : (
                <textarea
                  id={`form-${template._id}-${field.id}`}
                  value={String(answers[field.id] ?? "")}
                  onChange={(event) =>
                    setAnswers((current) => ({
                      ...current,
                      [field.id]: event.target.value,
                    }))
                  }
                  className="min-h-20 rounded-lg border border-line bg-card px-3 py-2 text-sm"
                />
              )}
            </div>
          ))}
          {error === null ? null : (
            <p
              className="rounded-md border border-danger-tx bg-danger-bg px-3 py-2 text-sm text-danger-tx"
              role="alert"
            >
              {error}
            </p>
          )}
          {message === null ? null : (
            <p
              className="rounded-md border border-green bg-soft px-3 py-2 text-sm text-green-ink"
              role="status"
            >
              {message}
            </p>
          )}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={working}
              onClick={() => void save()}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save draft
            </Button>
            <Button type="submit" variant="primary" disabled={working}>
              {working ? (
                <LoaderCircle
                  className="h-4 w-4 animate-spin"
                  aria-hidden="true"
                />
              ) : (
                <Check className="h-4 w-4" aria-hidden="true" />
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
  if (templates === undefined || submissions === undefined)
    return (
      <p className="flex items-center text-sm text-muted" role="status">
        <LoaderCircle
          className="mr-2 h-4 w-4 animate-spin"
          aria-hidden="true"
        />
        Loading forms…
      </p>
    );
  return (
    <div className="grid gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Forms and inspections</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {role === "owner" || role === "manager" ? (
            <TemplateCreator eventId={eventId} />
          ) : null}
          {templates.length === 0 ? (
            <EmptyState
              title="No inspection templates yet"
              description="An owner or manager can create the first vehicle inspection template."
            />
          ) : (
            templates.map((template) => (
              <SubmissionForm
                key={template._id}
                eventId={eventId}
                template={template}
              />
            ))
          )}
        </CardContent>
      </Card>
      {submissions.length === 0 ? null : (
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
      )}
    </div>
  );
}
