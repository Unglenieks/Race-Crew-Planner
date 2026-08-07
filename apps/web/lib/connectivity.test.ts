import { describe, expect, it } from "vitest";
import {
  connectionStateDescription,
  connectionStateLabel,
} from "./connectivity";

describe("connection status copy", () => {
  it("does not claim that unavailable writes are queued", () => {
    expect(connectionStateLabel("offline")).toBe("Connection unavailable");
    expect(connectionStateDescription("offline")).toBe(
      "Already-loaded information may remain visible. Changes need a connection unless a screen explicitly confirms it has queued them.",
    );
  });

  it("explains the initial browser connection check", () => {
    expect(connectionStateLabel("checking")).toBe("Checking connection");
  });
});
