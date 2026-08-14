import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutations = { uploadUrl: vi.fn(), save: vi.fn(), remove: vi.fn() };
let queryIndex = 0;
let mutationIndex = 0;
const files = [
  {
    _id: "files:one",
    name: "service-park.jpg",
    contentType: "image/jpeg",
    size: 1024,
    uploadedBy: "crew",
    createdAt: 0,
    recordId: "records:one",
    url: "https://example.test/file",
  },
];
const records = [{ _id: "records:one", name: "Service park", type: "venue" }];

vi.mock("convex/react", () => ({
  useQuery: () => [files, records, [], []][queryIndex++ % 4],
  useMutation: () => Object.values(mutations)[mutationIndex++],
}));

import { FilesLibrary } from "./files-library";

function renderLibrary(role: "owner" | "crew" | "spectator" = "owner") {
  queryIndex = 0;
  mutationIndex = 0;
  Object.values(mutations).forEach((mutation) => mutation.mockReset());
  return render(<FilesLibrary eventId="events:one" role={role} />);
}

describe("FilesLibrary", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the event and record association for a stored file", () => {
    renderLibrary();
    expect(screen.getByRole("link", { name: "service-park.jpg" })).toBeTruthy();
    expect(screen.getByText(/Record: Service park/)).toBeTruthy();
  });

  it("renders Crew as a read-only library without mounted file controls", () => {
    renderLibrary("crew");
    expect(screen.getByText("View only")).toBeTruthy();
    expect(screen.getByRole("link", { name: "service-park.jpg" })).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Choose file" })).toBeNull();
    expect(screen.queryByLabelText("Choose file")).toBeNull();
    expect(screen.queryByLabelText("Search attachment targets")).toBeNull();
    expect(
      screen.queryByRole("button", { name: /remove service-park/i }),
    ).toBeNull();
  });

  it("keeps the current spectator component behavior read-only", () => {
    renderLibrary("spectator");
    expect(screen.getByText("View only")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Choose file" })).toBeNull();
    expect(
      screen.queryByRole("button", { name: /remove service-park/i }),
    ).toBeNull();
  });

  it("provides an accessible keyboard-focusable upload trigger to file managers", () => {
    renderLibrary();
    const trigger = screen.getByRole("button", { name: "Choose file" });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    expect(screen.getByText("Can manage files")).toBeTruthy();
  });

  it("reports an oversize file before it requests an upload URL", () => {
    renderLibrary();
    const file = new File([new Uint8Array(10 * 1024 * 1024 + 1)], "large.pdf", {
      type: "application/pdf",
    });
    fireEvent.change(screen.getByLabelText("Choose file"), {
      target: { files: [file] },
    });
    fireEvent.submit(
      screen.getByRole("button", { name: "Store file" }).closest("form")!,
    );
    expect(screen.getByRole("alert").textContent).toContain(
      "between 1 byte and 10 MB",
    );
    expect(mutations.uploadUrl).not.toHaveBeenCalled();
  });

  it("requires a search before listing attachment targets", () => {
    renderLibrary();
    expect(
      screen.getByText("Start typing to find an attachment target."),
    ).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Search attachment targets"), {
      target: { value: "service" },
    });
    expect(
      screen.getByRole("button", { name: "Record · Service park" }),
    ).toBeTruthy();
  });
});
