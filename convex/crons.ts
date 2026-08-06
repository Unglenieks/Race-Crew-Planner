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

export default crons;
