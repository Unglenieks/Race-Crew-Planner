import type { Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";

export const auditKinds = [
  "comment.added",
  "source.added",
  "movement.created",
  "movement.updated",
  "movement.archived",
  "movement.restored",
  "movement.published",
  "work.created",
  "work.updated",
  "work.completed",
  "work.reopened",
  "work.commented",
  "record.created",
  "record.updated",
  "record.vocabularyChanged",
  "logistics.updated",
  "file.uploaded",
  "file.removed",
  "workTemplate.created",
  "workTemplate.applied",
  "workTemplate.archived",
  "workTemplate.restored",
  "inspection.templateCreated",
  "inspection.templateUpdated",
  "inspection.draftSaved",
  "inspection.submitted",
  "planChange.opened",
  "planChange.acknowledged",
] as const;

export type AuditKind = (typeof auditKinds)[number];

export async function writeAudit(
  ctx: MutationCtx,
  entry: {
    eventId: Id<"events">;
    actorId: string;
    kind: AuditKind;
    message: string;
    objectType?: string;
    objectId?: string;
    objectLabel?: string;
    href?: string;
    createdAt?: number;
  },
) {
  return await ctx.db.insert("eventActivity", {
    ...entry,
    createdAt: entry.createdAt ?? Date.now(),
  });
}
