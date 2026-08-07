import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// A harmless proving job. Product jobs belong in their own slices.
crons.interval(
  "record scheduler heartbeat",
  { minutes: 15 },
  internal.scheduler.recordHeartbeat,
  { name: "scheduler-primitive" },
);

crons.daily(
  "expire archived events after retention window",
  { hourUTC: 3, minuteUTC: 0 },
  internal.events.expireArchived,
  {},
);

export default crons;
