import { v } from "convex/values";
import { internalMutation } from "./_generated/server";

/**
 * Scheduled work has no Clerk identity, so jobs are internal-only and must
 * prove their scope through their explicit arguments and data access.
 */
export const recordHeartbeat = internalMutation({
  args: { name: v.string() },
  handler: async (ctx, { name }) => {
    const existing = await ctx.db
      .query("schedulerHeartbeats")
      .withIndex("by_name", (q) => q.eq("name", name))
      .unique();
    const lastRanAt = Date.now();

    if (existing === null) {
      await ctx.db.insert("schedulerHeartbeats", { name, lastRanAt });
      return;
    }

    await ctx.db.patch(existing._id, { lastRanAt });
  },
});
