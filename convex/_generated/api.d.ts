/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as activity from "../activity.js";
import type * as auth from "../auth.js";
import type * as currentUser from "../currentUser.js";
import type * as events from "../events.js";
import type * as forms from "../forms.js";
import type * as invitations from "../invitations.js";
import type * as itinerary from "../itinerary.js";
import type * as planChanges from "../planChanges.js";
import type * as planSections from "../planSections.js";
import type * as records from "../records.js";
import type * as work from "../work.js";
import type * as workTemplates from "../workTemplates.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  activity: typeof activity;
  auth: typeof auth;
  currentUser: typeof currentUser;
  events: typeof events;
  forms: typeof forms;
  invitations: typeof invitations;
  itinerary: typeof itinerary;
  planChanges: typeof planChanges;
  planSections: typeof planSections;
  records: typeof records;
  work: typeof work;
  workTemplates: typeof workTemplates;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
