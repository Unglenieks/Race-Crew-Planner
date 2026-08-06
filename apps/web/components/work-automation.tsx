"use client";

import { LoaderCircle, Pause, Play, Sparkles } from "lucide-react";
import { FormEvent, useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { type WorkAutomationRule, workAutomationApi } from "@/lib/events-api";
import { Badge } from "@/components/ui/badge";
import { Banner } from "@/components/ui/banner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/data-display";
import { Input } from "@/components/ui/input";

const triggerLabels: Record<WorkAutomationRule["trigger"], string> = {
  planChangePublished: "a plan change is published",
  workCompleted: "a work item is completed",
};

const actionLabels: Record<WorkAutomationRule["action"], string> = {
  createWorkItem: "create a work item",
  notifyAssignee: "notify an assignee",
};

export function WorkAutomation({ eventId }: { eventId: string }) {
  const rules = useQuery(workAutomationApi.list, { eventId });
  const create = useMutation(workAutomationApi.create);
  const setEnabled = useMutation(workAutomationApi.setEnabled);
  const [name, setName] = useState("");
  const [trigger, setTrigger] = useState<WorkAutomationRule["trigger"]>(
    "planChangePublished",
  );
  const [action, setAction] =
    useState<WorkAutomationRule["action"]>("createWorkItem");
  const [itemTitle, setItemTitle] = useState("");
  const [saving, setSaving] = useState(false);
  const [pendingRuleId, setPendingRuleId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function createRule(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSaving(true);
    try {
      await create({
        eventId,
        name,
        trigger,
        action,
        itemTitle: action === "createWorkItem" ? itemTitle : undefined,
      });
      setName("");
      setItemTitle("");
      setMessage(
        "Rule saved and marked enabled. It is configuration only for now.",
      );
    } catch {
      setError(
        "The rule was not saved. Check its name and configuration, then try again.",
      );
    } finally {
      setSaving(false);
    }
  }

  async function changeEnabled(rule: WorkAutomationRule, enabled: boolean) {
    setError(null);
    setMessage(null);
    setPendingRuleId(rule._id);
    try {
      await setEnabled({ eventId, ruleId: rule._id, enabled });
      setMessage(
        `${rule.name} is now ${enabled ? "enabled" : "paused"}. No work is created and no notification is sent.`,
      );
    } catch {
      setError(
        `The rule could not be ${enabled ? "enabled" : "paused"}. Please try again.`,
      );
    } finally {
      setPendingRuleId(null);
    }
  }

  const preview =
    action === "createWorkItem"
      ? itemTitle.trim()
        ? `It would create “${itemTitle.trim()}” when ${triggerLabels[trigger]}.`
        : `It would need a work-item title when ${triggerLabels[trigger]}.`
      : `It would notify an assignee when ${triggerLabels[trigger]}.`;

  return (
    <div className="grid items-start gap-4 xl:grid-cols-[1.35fr_.65fr]">
      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <CardTitle>Configured rules</CardTitle>
              <p className="mt-1 text-sm text-muted">
                Rules are stored for this event. Execution and notifications are
                not available yet.
              </p>
            </div>
            <Badge variant="neutral">Configuration only</Badge>
          </div>
        </CardHeader>
        <CardContent className="grid gap-4">
          {message === null ? null : (
            <Banner variant="success" label="Rule updated" role="status">
              {message}
            </Banner>
          )}
          {error === null ? null : (
            <Banner variant="danger" label="Rule update failed" role="alert">
              {error}
            </Banner>
          )}
          {rules === undefined ? (
            <div
              className="flex min-h-32 items-center text-sm text-muted"
              role="status"
            >
              <LoaderCircle
                className="mr-2 h-4 w-4 animate-spin"
                aria-hidden="true"
              />
              Loading rules…
            </div>
          ) : rules.length === 0 ? (
            <EmptyState
              title="No automation rules yet"
              description="Save a rule now to prepare an event for future automation."
            />
          ) : (
            <ol className="divide-y divide-line">
              {rules.map((rule) => {
                const pending = pendingRuleId === rule._id;
                return (
                  <li
                    key={rule._id}
                    className="flex flex-wrap items-start gap-3 py-4 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{rule.name}</p>
                        <Badge variant={rule.enabled ? "success" : "neutral"}>
                          {rule.enabled ? "Enabled" : "Paused"}
                        </Badge>
                      </div>
                      <p className="mt-2 text-sm text-muted">
                        When {triggerLabels[rule.trigger]},{" "}
                        {actionLabels[rule.action]}
                        {rule.itemTitle ? `: ${rule.itemTitle}` : ""}.
                      </p>
                      <p className="mt-1 text-xs font-medium text-warning-tx">
                        Stored only — it will not run or send a notification.
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant={rule.enabled ? "secondary" : "primary"}
                      onClick={() => changeEnabled(rule, !rule.enabled)}
                      disabled={pendingRuleId !== null}
                    >
                      {pending ? (
                        <LoaderCircle className="h-4 w-4 animate-spin" />
                      ) : rule.enabled ? (
                        <Pause className="h-4 w-4" aria-hidden="true" />
                      ) : (
                        <Play className="h-4 w-4" aria-hidden="true" />
                      )}
                      {rule.enabled ? "Pause" : "Enable"}
                    </Button>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Create a rule</CardTitle>
        </CardHeader>
        <CardContent>
          <form className="grid gap-4" onSubmit={createRule}>
            <label
              className="grid gap-1.5 text-sm font-medium text-ink"
              htmlFor="rule-name"
            >
              Rule name
              <Input
                id="rule-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={120}
                required
                placeholder="e.g. Plan change follow-up"
              />
            </label>
            <label
              className="grid gap-1.5 text-sm font-medium text-ink"
              htmlFor="rule-trigger"
            >
              When
              <select
                id="rule-trigger"
                value={trigger}
                onChange={(event) =>
                  setTrigger(
                    event.target.value as WorkAutomationRule["trigger"],
                  )
                }
                className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
              >
                <option value="planChangePublished">
                  A plan change is published
                </option>
                <option value="workCompleted">A work item is completed</option>
              </select>
            </label>
            <label
              className="grid gap-1.5 text-sm font-medium text-ink"
              htmlFor="rule-action"
            >
              Then
              <select
                id="rule-action"
                value={action}
                onChange={(event) =>
                  setAction(event.target.value as WorkAutomationRule["action"])
                }
                className="h-10 rounded-lg border border-line bg-card px-3 text-sm text-ink shadow-sm outline-none focus:border-ink focus:ring-2 focus:ring-ink"
              >
                <option value="createWorkItem">Create a work item</option>
                <option value="notifyAssignee">Notify an assignee</option>
              </select>
            </label>
            {action !== "createWorkItem" ? null : (
              <label
                className="grid gap-1.5 text-sm font-medium text-ink"
                htmlFor="rule-item-title"
              >
                Work-item title
                <Input
                  id="rule-item-title"
                  value={itemTitle}
                  onChange={(event) => setItemTitle(event.target.value)}
                  maxLength={160}
                  required
                  placeholder="e.g. Review published plan change"
                />
              </label>
            )}
            <div
              className="rounded-lg border border-warning-ln bg-warning-bg p-3"
              aria-live="polite"
            >
              <p className="flex items-center gap-2 text-sm font-semibold text-ink">
                <Sparkles className="h-4 w-4" aria-hidden="true" />
                Preview
              </p>
              <p className="mt-1 text-sm leading-relaxed text-ink2">
                {preview}
              </p>
              <p className="mt-2 text-xs leading-relaxed text-warning-tx">
                This is a preview of saved configuration only. Creating or
                enabling this rule will not create work or send notifications.
              </p>
            </div>
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? (
                <LoaderCircle className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4" aria-hidden="true" />
              )}
              Create enabled rule
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
