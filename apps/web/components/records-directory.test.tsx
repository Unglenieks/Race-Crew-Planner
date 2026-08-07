import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mutations = {
  create: vi.fn(),
  update: vi.fn(),
  createField: vi.fn(),
  updateField: vi.fn(),
  reorderFields: vi.fn(),
};
let queries: unknown[] = [];
let queryIndex = 0;
let mutationIndex = 0;

vi.mock("convex/react", () => ({
  useQuery: () => queries[queryIndex++ % 3],
  useMutation: () => Object.values(mutations)[mutationIndex++],
}));
vi.mock("next/link", () => ({
  default: ({ href, children, ...props }: React.ComponentProps<"a">) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

import { RecordsDirectory } from "./records-directory";

const records = [
  {
    _id: "records:one",
    name: "North gate",
    type: "venue",
    fieldValues: { status: "Ready" },
  },
  {
    _id: "records:two",
    name: "Fuel truck",
    type: "service",
    fieldValues: { status: "Hold" },
  },
];
const fields = [
  {
    _id: "fields:status",
    key: "status",
    label: "Status",
    type: "select" as const,
    options: ["Ready", "Hold"],
    order: 0,
  },
];

function renderDirectory(role: "owner" | "crew" = "owner") {
  queries = [records, [], fields];
  queryIndex = 0;
  mutationIndex = 0;
  Object.values(mutations).forEach((mutation) => mutation.mockReset());
  return render(<RecordsDirectory eventId="events:one" role={role} />);
}

describe("RecordsDirectory", () => {
  beforeEach(() => vi.clearAllMocks());

  it("switches views and filters the records behind the field control", () => {
    renderDirectory();
    fireEvent.change(screen.getByLabelText("Filter by field"), {
      target: { value: "status" },
    });
    fireEvent.change(screen.getByLabelText("Contains"), {
      target: { value: "Ready" },
    });
    expect(screen.getByText("North gate")).toBeTruthy();
    expect(screen.queryByText("Fuel truck")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /table/i }));
    expect(screen.getByRole("table")).toBeTruthy();
  });

  it("hides structure and edit controls from a view-only crew member", () => {
    renderDirectory("crew");
    expect(screen.queryByText("Directory fields")).toBeNull();
    expect(
      screen.queryByRole("button", { name: "Edit North gate" }),
    ).toBeNull();
  });

  it("keeps a failed record mutation visible in place", async () => {
    renderDirectory();
    mutations.create.mockRejectedValueOnce(new Error("offline"));
    fireEvent.change(screen.getByLabelText("Name"), {
      target: { value: "Medical" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add record" }));
    expect((await screen.findByRole("alert")).textContent).toContain(
      "changes were not saved",
    );
  });
});
