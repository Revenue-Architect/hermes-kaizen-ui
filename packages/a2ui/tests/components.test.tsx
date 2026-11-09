import * as React from "react";
import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { A2UI_RENDERED_COMPONENTS, A2uiSurfaceView } from "../src/components";
import { CATALOG_ICON_NAMES } from "../src/components/catalog-icons";
import type { A2uiComponent, A2uiSurface } from "../src/types";

function surface(
  components: A2uiComponent[],
  dataModel: Record<string, unknown> = {},
): A2uiSurface {
  return {
    surfaceId: "component-test",
    components: Object.fromEntries(
      components.map((component) => [component.id, component]),
    ),
    dataModel,
  };
}

afterEach(cleanup);

describe("A2UI React catalog renderer", () => {
  it("advertises the supported basic, legacy, and extension registry without the no-asset media types", () => {
    expect(A2UI_RENDERED_COMPONENTS).toHaveLength(47);
    expect(A2UI_RENDERED_COMPONENTS).toContain("DateTimeInput");
    expect(A2UI_RENDERED_COMPONENTS).toContain("ActionCallout");
    expect(A2UI_RENDERED_COMPONENTS).toContain("EvidenceTrail");
    expect(A2UI_RENDERED_COMPONENTS).not.toContain("Image");
    expect(A2UI_RENDERED_COMPONENTS).not.toContain("AudioPlayer");
    expect(A2UI_RENDERED_COMPONENTS).not.toContain("Video");
  });

  it("renders basic layout containers, tabs, and modal content without duplicate children", () => {
    render(
      <A2uiSurfaceView
        surface={surface([
          {
            id: "root",
            component: "Column",
            children: [
              "row",
              "card",
              "list",
              "tabs",
              "modal",
              "icon",
              "divider",
            ],
          },
          { id: "row", component: "Row", children: ["left", "right"] },
          { id: "left", component: "Text", text: "Left value", weight: 1 },
          { id: "right", component: "Text", text: "Right value", weight: 2 },
          { id: "card", component: "Card", child: "card-text" },
          { id: "card-text", component: "Text", text: "Card content" },
          {
            id: "list",
            component: "List",
            children: ["list-item"],
            direction: "vertical",
          },
          { id: "list-item", component: "Text", text: "List content" },
          {
            id: "tabs",
            component: "Tabs",
            tabs: [
              { label: "Overview", content: "overview" },
              { label: "Details", content: "details" },
            ],
          },
          { id: "overview", component: "Text", text: "Overview content" },
          { id: "details", component: "Text", text: "Details content" },
          {
            id: "modal",
            component: "Modal",
            trigger: "trigger",
            content: "modal-content",
          },
          { id: "trigger", component: "Button", child: "trigger-label" },
          {
            id: "trigger-label",
            component: "Text",
            text: "Open local details",
          },
          {
            id: "modal-content",
            component: "Text",
            text: "Local modal details",
          },
          { id: "icon", component: "Icon", name: "check" },
          { id: "divider", component: "Divider", axis: "horizontal" },
        ])}
      />,
    );

    expect(screen.getByText("Left value")).toBeTruthy();
    expect(screen.getByText("Right value")).toBeTruthy();
    expect(screen.getByText("Card content")).toBeTruthy();
    expect(screen.getByText("List content")).toBeTruthy();
    expect(screen.getByText("Overview content")).toBeTruthy();
    fireEvent.click(screen.getByRole("tab", { name: "Details" }));
    expect(screen.getByText("Details content")).toBeTruthy();
    expect(screen.queryByText("Overview content")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Open local details" }));
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Local modal details")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(screen.getByRole("img", { name: "Icon: check" })).toBeTruthy();
  });

  it("maps the complete bounded catalog icon set to SDK icons with a safe fallback", () => {
    const names = [...CATALOG_ICON_NAMES, "unrecognized-icon"];
    render(
      <A2uiSurfaceView
        surface={surface([
          { id: "root", component: "Column", children: names.map((_, i) => `icon-${i}`) },
          ...names.map((name, index) => ({ id: `icon-${index}`, component: "Icon", name })),
        ])}
      />,
    );
    expect(CATALOG_ICON_NAMES).toHaveLength(68);
    expect(screen.getAllByRole("img", { name: /^Icon:/ })).toHaveLength(69);
    expect(document.querySelector('[data-sdk-icon="Users"]')).toBeTruthy();
    expect(document.querySelector('[data-sdk-icon="NotebookTabs"]')).toBeTruthy();
    expect(document.querySelector('[data-sdk-icon="Cpu"]')).toBeTruthy();
    expect(document.querySelector('[data-sdk-icon="HelpCircle"]')).toBeTruthy();
  });

  it("uses the same SDK icon mapping for legacy custom widgets", () => {
    const view = render(
      <A2uiSurfaceView
        surface={surface([
          { id: "root", component: "InfoRow", title: "Clock", detail: "Scheduled", icon: "clock" },
        ])}
      />,
    );
    expect(view.container.querySelector('[data-sdk-icon="Clock"]')).toBeTruthy();
  });

  it("keeps a modal trigger disabled when the surface is disabled", () => {
    render(
      <A2uiSurfaceView
        disabled
        surface={surface([
          { id: "root", component: "Modal", trigger: "trigger", content: "content" },
          { id: "trigger", component: "Button", child: "label" },
          { id: "label", component: "Text", text: "Open disabled modal" },
          { id: "content", component: "Text", text: "Private content" },
        ])}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Open disabled modal" });
    expect((trigger as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(trigger);
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders every older custom widget and preserves their supported action children", () => {
    const view = render(
      <A2uiSurfaceView
        onInteraction={vi.fn(async () => undefined)}
        surface={surface([
          {
            id: "root",
            component: "Column",
            children: [
              "status",
              "metric",
              "mini",
              "info",
              "steps",
              "callout",
              "artifact",
              "bot",
              "expand",
              "progress",
              "activity",
              "schedule",
              "message",
              "command",
              "task",
              "keys",
              "compare",
            ],
          },
          {
            id: "status",
            component: "StatusBadge",
            label: "Gateway",
            state: "ok",
            detail: "Connected",
          },
          {
            id: "metric",
            component: "MetricTile",
            label: "Usage",
            value: 8,
            min: 0,
            max: 10,
            unit: "GiB",
            state: "ok",
            source: "Host sample",
          },
          {
            id: "mini",
            component: "MiniChart",
            label: "Latency",
            kind: "bar",
            points: [
              { label: "A", value: 4 },
              { label: "B", value: 7 },
            ],
            unit: "ms",
          },
          {
            id: "info",
            component: "InfoRow",
            title: "Disk",
            detail: "Space remains",
            meta: "checked now",
            state: "ok",
          },
          {
            id: "steps",
            component: "StepRail",
            steps: [
              { label: "Build", state: "done" },
              {
                label: "Review",
                state: "current",
                detail: "Review the output.",
              },
            ],
          },
          {
            id: "callout",
            component: "ActionCallout",
            title: "Next step",
            detail: "Review this result.",
            tone: "attention",
            actionChild: "call-action",
          },
          {
            id: "call-action",
            component: "Button",
            child: "call-label",
            action: { event: { name: "review.next", context: {} } },
          },
          { id: "call-label", component: "Text", text: "Ask about next step" },
          {
            id: "artifact",
            component: "ArtifactTile",
            name: "report.txt",
            kind: "document",
            sizeLabel: "1 KB",
            actionChild: "artifact-action",
          },
          {
            id: "artifact-action",
            component: "Button",
            child: "artifact-label",
            action: { event: { name: "artifact.explain", context: {} } },
          },
          { id: "artifact-label", component: "Text", text: "Ask about report" },
          {
            id: "bot",
            component: "BotBadge",
            label: "Kai",
            identity: "kai",
            detail: "Inventory",
          },
          {
            id: "expand",
            component: "ExpandableSection",
            title: "Details",
            subtitle: "One item",
            count: 1,
            child: "expand-content",
            initiallyExpanded: true,
          },
          { id: "expand-content", component: "Text", text: "Expanded locally" },
          {
            id: "progress",
            component: "ProgressMeter",
            label: "Completed",
            current: 5,
            total: 4,
            unit: "tasks",
            detail: "Observed count",
          },
          {
            id: "activity",
            component: "ActivityFeed",
            items: [
              {
                title: "Started",
                detail: "Work began.",
                time: "09:00",
                state: "ok",
              },
            ],
          },
          {
            id: "schedule",
            component: "ScheduleTile",
            title: "Meeting",
            date: "2026-10-08",
            start: "09:00",
            end: "10:00",
            location: "Room 2",
          },
          {
            id: "message",
            component: "MessagePreview",
            sender: "Kai",
            preview: "A short message preview.",
            channel: "agentmail",
            unread: true,
          },
          {
            id: "command",
            component: "CommandBlock",
            label: "Example",
            content: "echo safe",
            language: "shell",
            copyable: true,
          },
          {
            id: "task",
            component: "TaskTile",
            title: "Review",
            status: "in_progress",
            assignee: "Kai",
            detail: "Check the output.",
          },
          {
            id: "keys",
            component: "KeyValueGrid",
            title: "Properties",
            items: [{ label: "Mode", value: "Local" }],
          },
          {
            id: "compare",
            component: "ComparisonCard",
            title: "Option A",
            facts: [{ label: "Cost", value: "$10", state: "ok" }],
          },
        ])}
      />,
    );

    for (const text of [
      "Gateway",
      "8 GiB",
      "Connected",
      "Space remains",
      "Build",
      "Review this result.",
      "report.txt",
      "Inventory",
      "Expanded locally",
      "5 / 4 tasks",
      "Work began.",
      /Room 2/,
      "A short message preview.",
      "echo safe",
      "Check the output.",
      "Local",
      "$10",
    ]) {
      expect(screen.getByText(text)).toBeTruthy();
    }
    const barRects = Array.from(
      view.container.querySelectorAll('svg[aria-label^="Latency"] rect'),
    );
    expect(barRects).toHaveLength(2);
    for (const rect of barRects) {
      const x = Number(rect.getAttribute("x"));
      const y = Number(rect.getAttribute("y"));
      const width = Number(rect.getAttribute("width"));
      const height = Number(rect.getAttribute("height"));
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x + width).toBeLessThanOrEqual(640);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y + height).toBeLessThanOrEqual(150);
    }
    expect(
      screen.getByRole("button", { name: "Ask about next step" }),
    ).toBeTruthy();
    expect(
      screen.getByRole("button", { name: "Ask about report" }),
    ).toBeTruthy();
  });

  it("keeps code, evidence, and native choices readable with inherited host defaults", () => {
    const view = render(
      <A2uiSurfaceView
        surface={surface([
          {
            id: "root",
            component: "Column",
            children: ["command", "accepted", "choice", "source"],
          },
          {
            id: "command",
            component: "CommandBlock",
            label: "Safe command",
            language: "shell",
            content: "printf readable",
          },
          {
            id: "accepted",
            component: "CheckBox",
            label: "Accept terms",
            value: true,
          },
          {
            id: "choice",
            component: "ChoicePicker",
            label: "Environment",
            options: [
              { label: "Development", value: "dev" },
              { label: "Production", value: "prod" },
            ],
          },
          {
            id: "source",
            component: "SourceExcerpt",
            title: "Evidence",
            source: "Inspection report",
            location: "Page 4",
            excerpt: "Evidence should read as plain text.",
          },
        ])}
      />,
    );

    const command = screen.getByText("printf readable").closest("pre");
    expect(command?.style.background).toBe("var(--ui-bg-secondary)");
    expect(command?.style.color).toBe("var(--ui-text-primary)");
    expect(command?.style.border).toBe("1px solid var(--ui-stroke-tertiary)");

    expect(screen.getByRole("checkbox", { name: "Accept terms" }).style.accentColor).toBe(
      "var(--ui-accent-secondary)",
    );
    for (const name of ["Development", "Production"]) {
      expect(screen.getByRole("radio", { name }).style.accentColor).toBe(
        "var(--ui-accent-secondary)",
      );
    }

    const excerpt = view.container.querySelector("blockquote");
    expect(excerpt?.style.color).toBe("var(--ui-text-primary)");
    expect(excerpt?.style.fontStyle).toBe("normal");
    expect(excerpt?.style.fontWeight).toBe("400");
  });

  it("renders source evidence and drafts as complete, selectable, unsent content", () => {
    const view = render(
      <A2uiSurfaceView
        surface={surface([
          {
            id: "root",
            component: "Column",
            children: ["citation", "source", "draft", "evidence"],
          },
          {
            id: "citation",
            component: "CitationCard",
            title: "Report citation",
            source: "Inspection report",
            location: "Page 8",
            excerpt: "Exact source wording stays complete.",
            finding: "This is a separate finding.",
          },
          {
            id: "source",
            component: "SourceExcerpt",
            title: "Source excerpt",
            source: "Invoice",
            location: "Line 4",
            excerpt: "Quoted evidence, without rewriting.",
          },
          {
            id: "draft",
            component: "DraftReview",
            title: "Reply draft",
            recipient: "person@example.test",
            subject: "Proposal follow up",
            body: "This message is a draft and has not been sent.",
          },
          {
            id: "evidence",
            component: "EvidenceTrail",
            title: "Evidence trail",
            items: [
              {
                source: "Inspection report",
                location: "Page 8",
                fact: "Staining was observed.",
                interpretation: "The cause needs review.",
                uncertainty: "The source is not established.",
              },
            ],
          },
        ])}
      />,
    );

    expect(
      screen.getByText("Exact source wording stays complete."),
    ).toBeTruthy();
    expect(screen.getByText("This is a separate finding.")).toBeTruthy();
    expect(
      screen.getByText("Quoted evidence, without rewriting."),
    ).toBeTruthy();
    expect(screen.getByText("DRAFT / NOT SENT")).toBeTruthy();
    expect(screen.getByText("person@example.test")).toBeTruthy();
    expect(
      screen.getByText("This message is a draft and has not been sent."),
    ).toBeTruthy();
    expect(screen.getByText("Staining was observed.")).toBeTruthy();
    expect(screen.getByText("The cause needs review.")).toBeTruthy();
    expect(screen.getByText("The source is not established.")).toBeTruthy();
    expect(view.container.querySelector("a[href]")).toBeNull();
  });

  it("keeps table cells intact in records and compare modes, with table-only horizontal scrolling", () => {
    const view = render(
      <A2uiSurfaceView
        surface={surface([
          {
            id: "root",
            component: "DataTable",
            title: "Supplied options",
            columns: ["Option", "Cost", "Notes"],
            rows: [
              ["A", "$10", "Complete first note"],
              ["B", "$20", "Complete second note"],
            ],
          },
        ])}
      />,
    );

    expect(screen.getByText("Complete first note")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Compare columns" }));
    expect(screen.getByRole("table").querySelectorAll("th")).toHaveLength(3);
    expect(screen.getByText("Complete second note")).toBeTruthy();
    expect(
      view.container.querySelector("table")?.parentElement?.style.overflowX,
    ).toBe("auto");
    expect(
      view.container.firstElementChild?.scrollWidth ?? 0,
    ).toBeLessThanOrEqual(view.container.firstElementChild?.clientWidth ?? 0);
  });

  it("keeps decision and scenario exploration local and derives the supplied linear estimate", () => {
    render(
      <A2uiSurfaceView
        surface={surface([
          { id: "root", component: "Column", children: ["tree", "scenario"] },
          {
            id: "tree",
            component: "DecisionTree",
            title: "Local decision",
            start: "a",
            nodes: [
              {
                id: "a",
                label: "Choose a route",
                detail: "Start here.",
                options: [{ label: "Explore", target: "b" }],
              },
              {
                id: "b",
                label: "Selected route",
                detail: "This selection stays local.",
                options: [],
              },
            ],
          },
          {
            id: "scenario",
            component: "ScenarioSlider",
            title: "Estimate",
            inputLabel: "Hours",
            unit: "USD",
            min: 0,
            max: 10,
            value: 2,
            multiplier: 20,
            offset: 5,
            assumptions: "No taxes included.",
          },
        ])}
      />,
    );

    expect(screen.getByText("Estimate: 45 USD")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Explore" }));
    expect(screen.getByText("This selection stays local.")).toBeTruthy();
    fireEvent.change(screen.getByRole("slider", { name: "Hours" }), {
      target: { value: "3" },
    });
    expect(screen.getByText("Estimate: 65 USD")).toBeTruthy();
  });

  it("renders charts and maps with data text alternatives as well as their diagrams", () => {
    const view = render(
      <A2uiSurfaceView
        surface={surface([
          {
            id: "root",
            component: "Column",
            children: ["mini", "multi", "relations", "rooms"],
          },
          {
            id: "mini",
            component: "MiniChart",
            label: "Latency",
            kind: "line",
            unit: "ms",
            points: [
              { label: "Mon", value: 10 },
              { label: "Tue", value: 15 },
            ],
          },
          {
            id: "multi",
            component: "MultiSeriesChart",
            title: "Service times",
            labels: ["Mon", "Tue"],
            unit: "ms",
            series: [{ label: "API", values: [5, 8] }],
          },
          {
            id: "relations",
            component: "RelationshipMap",
            title: "Ownership",
            nodes: [
              { id: "project", label: "Project", detail: "Current work" },
              { id: "owner", label: "Owner", detail: "Assigned team" },
            ],
            edges: [{ source: "project", target: "owner", label: "owned by" }],
          },
          {
            id: "rooms",
            component: "RoomMap",
            title: "Rooms",
            provenance: "Illustrative supplied geometry.",
            rooms: [
              {
                id: "kitchen",
                label: "Kitchen",
                detail: "Supplied detail",
                x: 0,
                y: 0,
                width: 0.5,
                height: 1,
              },
              {
                id: "office",
                label: "Office",
                detail: "Other supplied detail",
                x: 0.5,
                y: 0,
                width: 0.5,
                height: 1,
              },
            ],
          },
        ])}
      />,
    );

    expect(
      view.container.querySelectorAll('svg[role="img"]').length,
    ).toBeGreaterThanOrEqual(4);
    const latencyChart = view.container.querySelector('svg[aria-label^="Latency:"]');
    expect(latencyChart?.getAttribute("style")).toContain("max-width: 640px");
    const chartLabels = latencyChart?.nextElementSibling;
    expect(chartLabels?.getAttribute("style")).toContain("max-width: 640px");
    expect(screen.getByText(/Mon: 10 ms/)).toBeTruthy();
    expect(screen.getByText(/Tue: 8 ms/)).toBeTruthy();
    expect(screen.getByText(/Project → Owner: owned by/)).toBeTruthy();
    const relationshipSvg = view.container.querySelector('svg[aria-label="Relationship map diagram"]');
    const viewBox = relationshipSvg?.getAttribute("viewBox")?.split(" ").map(Number) ?? [];
    relationshipSvg?.querySelectorAll("circle").forEach((circle) => {
      const cx = Number(circle.getAttribute("cx"));
      const cy = Number(circle.getAttribute("cy"));
      const outerRadius = Number(circle.getAttribute("r")) + Number(circle.getAttribute("stroke-width")) / 2;
      expect(cx - outerRadius).toBeGreaterThanOrEqual(viewBox[0]);
      expect(cy - outerRadius).toBeGreaterThanOrEqual(viewBox[1]);
      expect(cx + outerRadius).toBeLessThanOrEqual(viewBox[0] + viewBox[2]);
      expect(cy + outerRadius).toBeLessThanOrEqual(viewBox[1] + viewBox[3]);
    });
    expect(screen.getByText("Illustrative supplied geometry.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2. Office" }));
    expect(screen.getByText("Other supplied detail")).toBeTruthy();
  });

  it("shows an honest seven-day calendar with empty days, using only supplied events", () => {
    render(
      <A2uiSurfaceView
        surface={surface([
          {
            id: "root",
            component: "CalendarGrid",
            title: "Calendar",
            timezone: "America/Toronto",
            events: [
              {
                date: "2026-10-08",
                time: "09:00",
                label: "Planning",
                detail: "Supplied event.",
              },
            ],
          },
        ])}
      />,
    );

    expect(screen.getByRole("button", { name: "2026-10-14" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "2026-10-12" }));
    expect(screen.getByText("No supplied events for this day.")).toBeTruthy();
    expect(screen.queryByText(/Created event/)).toBeNull();
  });

  it("updates a bound form locally and submits its resolved value only from its explicit Button", async () => {
    const onInteraction = vi.fn(async () => undefined);
    const view = render(
      <A2uiSurfaceView
        onInteraction={onInteraction}
        surface={surface(
          [
            { id: "root", component: "Column", children: ["name", "submit"] },
            {
              id: "name",
              component: "TextField",
              label: "Name",
              value: { path: "/form/name" },
            },
            {
              id: "submit",
              component: "Button",
              child: "submit-label",
              action: {
                event: {
                  name: "form.save",
                  context: { name: { path: "/form/name" } },
                },
              },
            },
            { id: "submit-label", component: "Text", text: "Submit name" },
          ],
          { form: { name: "Initial" } },
        )}
      />,
    );

    expect(onInteraction).not.toHaveBeenCalled();
    fireEvent.change(screen.getByRole("textbox", { name: "Name" }), {
      target: { value: "Updated" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Submit name" }));
    fireEvent.click(screen.getByRole("button", { name: "Submit name" }));
    await waitFor(() => expect(onInteraction).toHaveBeenCalledTimes(1));
    expect(onInteraction).toHaveBeenCalledWith({
      surfaceId: "component-test",
      sourceComponentId: "submit",
      name: "form.save",
      context: { name: "Updated" },
    });
    expect(view.container.querySelector("input")?.value).toBe("Updated");
  });

  it("binds checkbox, choice, slider, and date controls locally until an explicit submit", async () => {
    const onInteraction = vi.fn(async () => undefined);
    render(
      <A2uiSurfaceView
        onInteraction={onInteraction}
        surface={surface(
          [
            {
              id: "root",
              component: "Column",
              children: ["accepted", "choices", "level", "date", "save"],
            },
            {
              id: "accepted",
              component: "CheckBox",
              label: "Accept terms",
              value: { path: "/form/accepted" },
            },
            {
              id: "choices",
              component: "ChoicePicker",
              label: "Options",
              variant: "multipleSelection",
              options: [
                { label: { path: "/form/optionLabel" }, value: "a" },
                { label: "Beta", value: "b" },
              ],
              value: { path: "/form/choices" },
            },
            {
              id: "level",
              component: "Slider",
              label: "Level",
              min: 0,
              max: 10,
              value: { path: "/form/level" },
            },
            {
              id: "date",
              component: "DateTimeInput",
              label: "Date",
              enableDate: true,
              enableTime: false,
              value: { path: "/form/date" },
            },
            {
              id: "save",
              component: "Button",
              child: "save-label",
              action: {
                event: {
                  name: "form.submit",
                  context: {
                    accepted: { path: "/form/accepted" },
                    choices: { path: "/form/choices" },
                    level: { path: "/form/level" },
                    date: { path: "/form/date" },
                  },
                },
              },
            },
            { id: "save-label", component: "Text", text: "Save selection" },
          ],
          {
            form: {
              accepted: false,
              optionLabel: "Alpha",
              choices: [],
              level: 2,
              date: "2026-10-08",
            },
          },
        )}
      />,
    );

    fireEvent.click(screen.getByRole("checkbox", { name: "Accept terms" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Alpha" }));
    fireEvent.change(screen.getByRole("slider", { name: "Level" }), {
      target: { value: "7" },
    });
    fireEvent.change(screen.getByLabelText("Date"), {
      target: { value: "2026-10-12" },
    });
    expect(onInteraction).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Save selection" }));

    await waitFor(() => expect(onInteraction).toHaveBeenCalledTimes(1));
    expect(onInteraction).toHaveBeenCalledWith({
      surfaceId: "component-test",
      sourceComponentId: "save",
      name: "form.submit",
      context: { accepted: true, choices: ["a"], level: 7, date: "2026-10-12" },
    });
  });

  it("renders the remaining extension controls and preserves their complete content", () => {
    render(
      <A2uiSurfaceView
        surface={surface([
          {
            id: "root",
            component: "Column",
            children: ["diff", "agenda", "journey"],
          },
          {
            id: "diff",
            component: "ChangeDiff",
            title: "Change preview",
            before: "Same\nOld wording\nEnd",
            after: "Same\nNew wording\nEnd",
          },
          {
            id: "agenda",
            component: "Agenda",
            title: "Agenda",
            timezone: "America/Toronto",
            events: [
              {
                date: "2026-10-08",
                time: "09:00",
                label: "Planning",
                detail: "Review the supplied plan.",
              },
            ],
          },
          {
            id: "journey",
            component: "JourneyMap",
            title: "Journey",
            stages: [
              {
                label: "Arrival",
                time: "09:00",
                place: "Station",
                cost: "$5",
                detail: "Walk to the meeting.",
              },
            ],
          },
        ])}
      />,
    );

    expect(
      screen.getByText("Preview only · not an applicable patch"),
    ).toBeTruthy();
    expect(screen.getByText("− Old wording")).toBeTruthy();
    expect(screen.getByText("+ New wording")).toBeTruthy();
    expect(screen.getByText("Timezone: America/Toronto")).toBeTruthy();
    expect(screen.getByText("Review the supplied plan.")).toBeTruthy();
    expect(screen.getByText("Walk to the meeting.")).toBeTruthy();
  });

  it("respects read-only action guards while leaving local presentation choices usable", () => {
    const onInteraction = vi.fn(async () => undefined);
    render(
      <A2uiSurfaceView
        disabled
        onInteraction={onInteraction}
        surface={surface([
          { id: "root", component: "Column", children: ["draft", "options"] },
          {
            id: "draft",
            component: "DraftReview",
            title: "Draft",
            recipient: "r@example.test",
            subject: "Subject",
            body: "Unsent.",
            actionChild: "ask",
          },
          {
            id: "ask",
            component: "Button",
            child: "ask-label",
            action: { event: { name: "draft.request_edit", context: {} } },
          },
          { id: "ask-label", component: "Text", text: "Request edit" },
          {
            id: "options",
            component: "DataTable",
            title: "Options",
            columns: ["Choice"],
            rows: [["A"]],
          },
        ])}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Request edit" }));
    expect(
      (
        screen.getByRole("button", {
          name: "Request edit",
        }) as HTMLButtonElement
      ).disabled,
    ).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Compare columns" }));
    expect(screen.getByRole("table")).toBeTruthy();
    expect(onInteraction).not.toHaveBeenCalled();
  });

  it("keeps model text as text and passes optional images only through the supplied callback", () => {
    const renderMedia = vi.fn((path: string) => (
      <span>Authorized preview: {path}</span>
    ));
    const view = render(
      <A2uiSurfaceView
        renderMedia={renderMedia}
        surface={surface([
          { id: "root", component: "Column", children: ["text", "comparison"] },
          {
            id: "text",
            component: "Text",
            text: "<img src=x onerror=alert(1)>",
          },
          {
            id: "comparison",
            component: "BeforeAfterViewer",
            title: "Comparison",
            before: "Before evidence.",
            after: "After evidence.",
            beforeMedia: "/authorized/before.png",
            afterMedia: "/authorized/after.png",
          },
        ])}
      />,
    );

    expect(screen.getByText("<img src=x onerror=alert(1)>")).toBeTruthy();
    expect(view.container.querySelector("img")).toBeNull();
    expect(
      screen.getByText("Authorized preview: /authorized/before.png"),
    ).toBeTruthy();
    expect(renderMedia).toHaveBeenCalledWith("/authorized/before.png");
    fireEvent.click(screen.getByRole("button", { name: "After" }));
    expect(
      screen.getByText("Authorized preview: /authorized/after.png"),
    ).toBeTruthy();
  });

  it("isolates a failing media renderer to its component and leaves sibling content available", () => {
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => undefined);
    try {
      render(
        <A2uiSurfaceView
          renderMedia={() => {
            throw new Error("media rendering failed");
          }}
          surface={surface([
            {
              id: "root",
              component: "Column",
              children: ["comparison", "sibling"],
            },
            {
              id: "comparison",
              component: "BeforeAfterViewer",
              title: "Comparison",
              before: "Before evidence.",
              after: "After evidence.",
              beforeMedia: "/authorized/before.png",
              afterMedia: "/authorized/after.png",
            },
            {
              id: "sibling",
              component: "Text",
              text: "Still readable after media failure.",
            },
          ])}
        />,
      );

      expect(
        screen.getByText("BeforeAfterViewer could not be displayed."),
      ).toBeTruthy();
      expect(
        screen.getByText("Still readable after media failure."),
      ).toBeTruthy();
    } finally {
      consoleError.mockRestore();
    }
  });
});
