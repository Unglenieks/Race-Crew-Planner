import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

let mode: "builder" | "records" | "short" = "builder";
const submitted = {
  _id: "formSubmissions:one",
  templateId: "formTemplates:one",
  templateName: "Vehicle inspection",
  templateVersion: 2,
  fields: [
    {
      id: "notes",
      label: "Inspector notes",
      type: "longText",
      required: false,
    },
  ],
  answers: { notes: "Brake line replaced." },
  status: "submitted",
  createdBy: "crew_123",
  createdAt: 1,
  updatedAt: 2,
  submittedAt: 2,
};

vi.mock("@/lib/events-api", () => ({
  formsApi: {
    listTemplates: "forms:listTemplates",
    listMySubmissions: "forms:listMySubmissions",
    listSubmissions: "forms:listSubmissions",
    getSubmission: "forms:getSubmission",
    createTemplate: "forms:createTemplate",
    createTemplateVersion: "forms:createTemplateVersion",
    saveDraft: "forms:saveDraft",
    submit: "forms:submit",
  },
  filesApi: { list: "files:list" },
  recordsApi: { list: "records:list" },
  workApi: { listAssignees: "work:listAssignees" },
}));

vi.mock("convex/react", () => ({
  useQuery: (reference: string, args: unknown) => {
    if (args === "skip") return undefined;
    if (reference === "forms:listTemplates")
      return mode === "short"
        ? [
            {
              _id: "formTemplates:short",
              name: "Driver check",
              version: 1,
              fields: [
                {
                  id: "driver",
                  label: "Driver name",
                  type: "shortText",
                  required: true,
                },
              ],
            },
          ]
        : [];
    if (reference === "forms:listMySubmissions") return [];
    if (reference === "forms:listSubmissions")
      return mode === "records" ? [submitted] : [];
    if (reference === "forms:getSubmission") return submitted;
    return [];
  },
  useMutation: () => vi.fn().mockResolvedValue("formSubmissions:one"),
}));

import { FormsInspections } from "./forms-inspections";

describe("FormsInspections", () => {
  afterEach(() => {
    mode = "builder";
  });

  it("generates identifiers from labels and keeps manual IDs under Advanced", () => {
    render(<FormsInspections eventId="events:one" role="manager" />);
    fireEvent.click(screen.getByRole("button", { name: "Build a template" }));
    const labels = screen.getAllByLabelText("Label");
    fireEvent.change(labels[0]!, { target: { value: "Brake condition" } });
    fireEvent.click(screen.getAllByText("Advanced")[0]!);
    expect(
      (screen.getAllByLabelText("Field identifier")[0] as HTMLInputElement)
        .value,
    ).toBe("brake_condition");
  });

  it("shows submitted answers as a read-only snapshot", () => {
    mode = "records";
    render(<FormsInspections eventId="events:one" role="manager" />);
    fireEvent.click(screen.getByRole("button", { name: "Review submission" }));
    expect(screen.getByText("Brake line replaced.")).toBeDefined();
    expect(screen.getByText(/submitted snapshot — read only/i)).toBeDefined();
    expect(screen.queryByText("Continue this draft")).toBeNull();
  });

  it("renders short text with a single-line input", () => {
    mode = "short";
    render(<FormsInspections eventId="events:one" role="crew" />);
    const field = screen.getByLabelText("Driver name (required)");
    expect(field.tagName).toBe("INPUT");
    expect(field.getAttribute("type")).not.toBe("textarea");
  });
});
