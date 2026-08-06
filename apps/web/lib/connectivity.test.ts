import { describe, expect, it } from "vitest";
import {
  connectionStateDescription,
  connectionStateLabel,
} from "./connectivity";

describe("connection status copy", () => {
  it("does not describe an unavailable connection as queued or synchronized", () => {
    expect(connectionStateLabel("offline")).toBe("Connection unavailable");
    expect(connectionStateDescription("offline")).toBe(
      "Already-loaded information may remain visible, but changes cannot be saved or queued.",
    );
  });

  it("explains the initial browser connection check", () => {
    expect(connectionStateLabel("checking")).toBe("Checking connection");
  });
});
