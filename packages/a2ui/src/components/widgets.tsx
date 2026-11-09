import * as React from "react";
import { Badge, Button } from "@hermes/plugin-sdk";
import type { A2uiComponent } from "../types";
import { CatalogIcon } from "./catalog-icons";

export interface WidgetRendererProps {
  renderChild: (id: string) => React.ReactNode;
  value: (key: string, fallback?: unknown) => unknown;
  stringValue: (key: string, fallback?: string) => string;
  numberValue: (key: string, fallback?: number) => number;
  setBoundValue: (key: string, value: unknown) => void;
  renderMedia?: (path: string) => React.ReactNode;
}

export function renderCatalogWidget(
  component: A2uiComponent,
  props: WidgetRendererProps,
): React.ReactElement {
  return <CatalogWidget component={component} {...props} />;
}

function CatalogWidget({
  component,
  ...props
}: WidgetRendererProps & { component: A2uiComponent }): React.ReactElement {
  if (EXTENSION_TYPES.has(component.component))
    return <ExtensionWidget component={component} {...props} />;
  return <LegacyWidget component={component} {...props} />;
}

const EXTENSION_TYPES = new Set([
  "CitationCard",
  "SourceExcerpt",
  "DataTable",
  "DraftReview",
  "ChangeDiff",
  "MultiSeriesChart",
  "Agenda",
  "CalendarGrid",
  "DecisionTree",
  "ScenarioSlider",
  "RelationshipMap",
  "RoomMap",
  "BeforeAfterViewer",
  "JourneyMap",
  "EvidenceTrail",
]);

const textStyle: React.CSSProperties = {
  lineHeight: 1.5,
  minWidth: 0,
  overflowWrap: "anywhere",
  whiteSpace: "pre-wrap",
};
const selectableStyle: React.CSSProperties = {
  ...textStyle,
  userSelect: "text",
};
const sectionStyle: React.CSSProperties = {
  border: "1px solid var(--ui-stroke-tertiary)",
  minWidth: 0,
  padding: "0.8em",
};
const stackStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.65em",
  minWidth: 0,
};
const metaStyle: React.CSSProperties = {
  color: "var(--ui-text-secondary)",
  fontSize: "var(--kaizen-text-small, 0.88em)",
  lineHeight: 1.4,
  overflowWrap: "anywhere",
};

function LegacyWidget(
  props: WidgetRendererProps & { component: A2uiComponent },
): React.ReactElement {
  const {
    component,
    renderChild,
    stringValue: s,
    numberValue: n,
    value: v,
  } = props;
  switch (component.component) {
    case "StatusBadge": {
      const state = s("state", "unknown");
      return (
        <div
          aria-label={`${s("label")}: ${state}${s("detail") ? `. ${s("detail")}` : ""}`}
          style={{
            alignItems: "center",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.4em",
          }}
        >
          <Badge variant={badgeVariant(state)}>{state.toUpperCase()}</Badge>
          <strong>{s("label")}</strong>
          {s("detail") ? <span style={metaStyle}>{s("detail")}</span> : null}
        </div>
      );
    }
    case "MetricTile": {
      const value = n("value");
      const min = n("min", Number.NaN);
      const max = n("max", Number.NaN);
      const hasRange =
        Number.isFinite(min) && Number.isFinite(max) && max > min;
      const within = hasRange && value >= min && value <= max;
      const percent = hasRange
        ? Math.max(0, Math.min(100, ((value - min) / (max - min)) * 100))
        : 0;
      return (
        <section
          aria-label={`${s("label")}: ${formatNumber(value)} ${s("unit")}`}
          style={sectionStyle}
        >
          <div style={metaStyle}>{s("label")}</div>
          <div
            style={{
              fontSize: "calc(var(--kaizen-text-base, 1em) * 1.5)",
              fontVariantNumeric: "tabular-nums",
              fontWeight: 650,
              lineHeight: 1.25,
              margin: "0.15em 0",
            }}
          >
            {formatNumber(value)}
            {s("unit") ? ` ${s("unit")}` : ""}
          </div>
          {hasRange ? (
            <>
              <div
                aria-label={`Range ${formatNumber(min)} to ${formatNumber(max)} ${s("unit")}`}
                role="img"
                style={{
                  background: "var(--ui-bg-tertiary)",
                  height: "0.35em",
                  margin: "0.55em 0",
                  overflow: "hidden",
                  width: "100%",
                }}
              >
                <div
                  style={{
                    background: within
                      ? "var(--ui-accent-secondary)"
                      : "var(--ui-red)",
                    height: "100%",
                    width: `${percent}%`,
                  }}
                />
              </div>
              <div style={metaStyle}>
                {formatNumber(min)} – {formatNumber(max)}
                {s("unit") ? ` ${s("unit")}` : ""}
                {!within ? " · Outside expected range" : ""}
              </div>
            </>
          ) : null}
          {s("state") ? (
            <Badge variant={badgeVariant(s("state"))}>{s("state")}</Badge>
          ) : null}
          {s("source") || s("asOf") ? (
            <div style={metaStyle}>
              {[
                s("source") ? `Source: ${s("source")}` : "",
                s("asOf") ? `As of ${s("asOf")}` : "",
              ]
                .filter(Boolean)
                .join(" · ")}
            </div>
          ) : null}
        </section>
      );
    }
    case "MiniChart":
      return <MiniChart {...props} />;
    case "InfoRow":
      return (
        <div
          style={{
            alignItems: "flex-start",
            borderBottom: "1px solid var(--ui-stroke-tertiary)",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.6em",
            minWidth: 0,
            padding: s("compact") === "true" ? "0.35em 0" : "0.6em 0",
          }}
        >
          <span
            aria-hidden="true"
            style={{ color: "var(--ui-text-secondary)" }}
          >
            <CatalogIcon name={s("icon")} />
          </span>
          <strong style={{ flex: "0 1 auto" }}>{s("title")}</strong>
          {s("detail") ? (
            <span style={{ ...textStyle, flex: "1 1 12em" }}>
              {s("detail")}
            </span>
          ) : null}
          {s("meta") ? <span style={metaStyle}>{s("meta")}</span> : null}
          {s("state") ? (
            <Badge variant={badgeVariant(s("state"))}>{s("state")}</Badge>
          ) : null}
        </div>
      );
    case "StepRail":
      return (
        <ol
          aria-label="Steps"
          style={{
            borderInlineStart: "1px solid var(--ui-stroke-secondary)",
            listStyle: "none",
            margin: 0,
            padding: "0 0 0 1em",
          }}
        >
          {list(v("steps")).map((step, index) => {
            const state = str(step.state, "upcoming");
            return (
              <li
                key={`${step.label}:${index}`}
                style={{ marginBottom: "0.7em", paddingInlineStart: "0.3em" }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.45em",
                  }}
                >
                  <Badge
                    variant={state === "done" ? "success" : badgeVariant(state)}
                  >
                    {state}
                  </Badge>
                  <strong>{str(step.label)}</strong>
                </div>
                {step.detail ? (
                  <div style={textStyle}>{str(step.detail)}</div>
                ) : null}
                {step.meta ? (
                  <div style={metaStyle}>{str(step.meta)}</div>
                ) : null}
              </li>
            );
          })}
        </ol>
      );
    case "ActionCallout": {
      const tone = s("tone", "neutral");
      return (
        <section aria-label={`${tone}: ${s("title")}`} style={sectionStyle}>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "0.35em" }}
          >
            {s("eyebrow") ? <div style={metaStyle}>{s("eyebrow")}</div> : null}
            <div
              style={{
                alignItems: "flex-start",
                display: "flex",
                flexWrap: "wrap",
                gap: "0.5em",
              }}
            >
              {s("icon") ? (
                <CatalogIcon aria-hidden="true" name={s("icon")} />
              ) : null}
              <strong>{s("title")}</strong>
              <Badge variant={badgeVariant(tone)}>{tone}</Badge>
            </div>
            {s("detail") ? <div style={textStyle}>{s("detail")}</div> : null}
            {legacyActionChild(component, renderChild, props)}
          </div>
        </section>
      );
    }
    case "ArtifactTile":
      return (
        <div
          style={{
            alignItems: "flex-start",
            borderBottom: "1px solid var(--ui-stroke-tertiary)",
            display: "flex",
            flexWrap: "wrap",
            gap: "0.55em",
            minWidth: 0,
            padding: "0.6em 0",
          }}
        >
          <Badge variant="muted">{s("kind", "file")}</Badge>
          <strong style={{ overflowWrap: "anywhere" }}>{s("name")}</strong>
          {s("sizeLabel") ? (
            <span style={metaStyle}>{s("sizeLabel")}</span>
          ) : null}
          {s("detail") ? (
            <span style={{ ...textStyle, flex: "1 1 10em" }}>
              {s("detail")}
            </span>
          ) : null}
          {legacyActionChild(component, renderChild, props)}
        </div>
      );
    case "BotBadge":
      return (
        <div
          style={{
            alignItems: "center",
            display: "inline-flex",
            flexWrap: "wrap",
            gap: "0.45em",
          }}
        >
          <Badge variant="outline">{s("identity", "neutral")}</Badge>
          <strong>{s("label")}</strong>
          {s("detail") ? <span style={metaStyle}>{s("detail")}</span> : null}
        </div>
      );
    case "ExpandableSection":
      return (
        <details
          open={v("initiallyExpanded") === true}
          style={{
            borderBottom: "1px solid var(--ui-stroke-tertiary)",
            minWidth: 0,
            padding: "0.4em 0",
          }}
        >
          <summary
            style={{
              cursor: "pointer",
              minHeight: "2.5em",
              padding: "0.35em 0",
            }}
          >
            <strong>{s("title")}</strong>
            {v("count") != null ? (
              <span style={metaStyle}> · {String(v("count"))}</span>
            ) : null}
            {s("subtitle") ? (
              <span style={metaStyle}> · {s("subtitle")}</span>
            ) : null}
          </summary>
          <div style={{ padding: "0.4em 0 0 0.9em" }}>
            {typeof component.child === "string"
              ? renderChild(component.child)
              : null}
          </div>
        </details>
      );
    case "ProgressMeter": {
      const current = n("current");
      const total = n("total", 1);
      const percent =
        total > 0 ? Math.max(0, Math.min(100, (current / total) * 100)) : 0;
      return (
        <section
          aria-label={`${s("label")}: ${formatNumber(current)} of ${formatNumber(total)} ${s("unit")}`}
          style={{
            ...stackStyle,
            borderBottom: "1px solid var(--ui-stroke-tertiary)",
            padding: "0.55em 0",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.5em",
            }}
          >
            <strong>{s("label")}</strong>
            {s("state") ? (
              <Badge variant={badgeVariant(s("state"))}>{s("state")}</Badge>
            ) : null}
            <span style={metaStyle}>
              {formatNumber(current)} / {formatNumber(total)}
              {s("unit") ? ` ${s("unit")}` : ""}
            </span>
          </div>
          <div
            aria-hidden="true"
            style={{
              background: "var(--ui-bg-tertiary)",
              height: "0.35em",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                background: "var(--ui-accent-secondary)",
                height: "100%",
                width: `${percent}%`,
              }}
            />
          </div>
          {s("detail") ? <span style={metaStyle}>{s("detail")}</span> : null}
        </section>
      );
    }
    case "ActivityFeed":
      return (
        <ol
          aria-label="Activity"
          style={{
            borderInlineStart: "1px solid var(--ui-stroke-secondary)",
            listStyle: "none",
            margin: 0,
            padding: "0 0 0 1em",
          }}
        >
          {list(v("items")).map((item, index) => (
            <li
              key={`${item.title}:${index}`}
              style={{ marginBottom: "0.7em", paddingInlineStart: "0.25em" }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.5em",
                }}
              >
                {item.icon ? (
                  <CatalogIcon aria-hidden="true" name={str(item.icon)} />
                ) : null}
                <strong>{str(item.title)}</strong>
                {item.state ? (
                  <Badge variant={badgeVariant(str(item.state))}>
                    {str(item.state)}
                  </Badge>
                ) : null}
                {item.time ? (
                  <span style={metaStyle}>{str(item.time)}</span>
                ) : null}
              </div>
              {item.detail ? (
                <div style={textStyle}>{str(item.detail)}</div>
              ) : null}
            </li>
          ))}
        </ol>
      );
    case "ScheduleTile":
      return (
        <section
          style={{
            borderBottom: "1px solid var(--ui-stroke-tertiary)",
            minWidth: 0,
            padding: "0.55em 0",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.45em",
            }}
          >
            {s("icon") ? (
              <CatalogIcon aria-hidden="true" name={s("icon")} />
            ) : null}
            <strong>{s("title")}</strong>
            {s("state") ? (
              <Badge variant={badgeVariant(s("state"))}>{s("state")}</Badge>
            ) : null}
          </div>
          <div style={metaStyle}>
            {[
              s("date"),
              s("start") && s("end") ? `${s("start")}–${s("end")}` : s("start"),
              s("location"),
              s("owner") ? `Owner: ${s("owner")}` : "",
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {s("detail") ? <div style={textStyle}>{s("detail")}</div> : null}
        </section>
      );
    case "MessagePreview":
      return (
        <article style={sectionStyle}>
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.45em",
            }}
          >
            <strong>{s("sender")}</strong>
            {s("channel") ? (
              <Badge variant="muted">{s("channel")}</Badge>
            ) : null}
            {v("unread") === true ? (
              <Badge variant="default">Unread</Badge>
            ) : null}
            {s("importance") === "important" ? (
              <Badge variant="warn">Important</Badge>
            ) : null}
            {s("timestamp") ? (
              <span style={metaStyle}>{s("timestamp")}</span>
            ) : null}
          </div>
          {s("title") ? (
            <div style={{ fontWeight: 600, marginTop: "0.35em" }}>
              {s("title")}
            </div>
          ) : null}
          <div style={textStyle}>{s("preview")}</div>
        </article>
      );
    case "CommandBlock":
      return <CommandBlock {...props} />;
    case "TaskTile":
      return (
        <section
          style={{
            borderBottom: "1px solid var(--ui-stroke-tertiary)",
            minWidth: 0,
            padding: "0.55em 0",
          }}
        >
          <div
            style={{
              alignItems: "center",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.45em",
            }}
          >
            <strong>{s("title")}</strong>
            <Badge
              variant={
                s("status") === "done" ? "success" : badgeVariant(s("status"))
              }
            >
              {s("status", "unknown")}
            </Badge>
            {s("priority") ? (
              <Badge
                variant={
                  s("priority") === "urgent" || s("priority") === "high"
                    ? "warn"
                    : "muted"
                }
              >
                {s("priority")}
              </Badge>
            ) : null}
          </div>
          <div style={metaStyle}>
            {[
              s("assignee") ? `Assigned to ${s("assignee")}` : "",
              s("due") ? `Due ${s("due")}` : "",
              s("countLabel"),
            ]
              .filter(Boolean)
              .join(" · ")}
          </div>
          {s("detail") ? <div style={textStyle}>{s("detail")}</div> : null}
        </section>
      );
    case "KeyValueGrid":
      return (
        <section style={stackStyle}>
          {s("title") ? <strong>{s("title")}</strong> : null}
          <div
            style={{
              display: "grid",
              gap: "0.5em 1em",
              gridTemplateColumns:
                s("compact") === "true"
                  ? "repeat(auto-fit, minmax(min(100%, 11em), 1fr))"
                  : "repeat(auto-fit, minmax(min(100%, 15em), 1fr))",
              minWidth: 0,
            }}
          >
            {list(v("items")).map((item, index) => (
              <div key={`${item.label}:${index}`} style={{ minWidth: 0 }}>
                <div style={metaStyle}>{str(item.label)}</div>
                <div style={selectableStyle}>{str(item.value)}</div>
              </div>
            ))}
          </div>
        </section>
      );
    case "ComparisonCard":
      return (
        <section style={stackStyle}>
          <strong>{s("title")}</strong>
          {s("subtitle") ? (
            <span style={metaStyle}>{s("subtitle")}</span>
          ) : null}
          {list(v("facts")).map((fact, index) => (
            <div
              key={`${fact.label}:${index}`}
              style={{
                borderBottom: "1px solid var(--ui-stroke-tertiary)",
                minWidth: 0,
                padding: "0.5em 0",
              }}
            >
              <div
                style={{
                  alignItems: "center",
                  display: "flex",
                  flexWrap: "wrap",
                  gap: "0.45em",
                }}
              >
                <strong>{str(fact.label)}</strong>
                {fact.badge ? (
                  <Badge variant="muted">{str(fact.badge)}</Badge>
                ) : null}
                {fact.state ? (
                  <Badge variant={badgeVariant(str(fact.state))}>
                    {str(fact.state)}
                  </Badge>
                ) : null}
              </div>
              <div style={selectableStyle}>{str(fact.value)}</div>
              {fact.detail ? (
                <div style={metaStyle}>{str(fact.detail)}</div>
              ) : null}
            </div>
          ))}
        </section>
      );
    default:
      return unavailable(component.component);
  }
}

function MiniChart({
  component,
  ...props
}: WidgetRendererProps & { component: A2uiComponent }): React.ReactElement {
  const points = list(props.value("points")).map((point) => ({
    label: str(point.label),
    value: finite(point.value),
  }));
  const label = props.stringValue("label");
  const unit = props.stringValue("unit");
  if (points.length < 2)
    return (
      <div
        role="img"
        aria-label={
          points.length === 1
            ? `${label}: one sample ${points[0].value} ${unit}`
            : `${label}: no observations`
        }
        style={sectionStyle}
      >
        <strong>{label}</strong>
        <div style={metaStyle}>
          {points.length === 1
            ? `One sample: ${formatNumber(points[0].value)} ${unit}. Add another observation to show a trend.`
            : "No observations yet."}
        </div>
      </div>
    );
  const values = points.map((point) => point.value);
  const low = Math.min(...values);
  const high = Math.max(...values);
  const kind = props.stringValue("kind", "line");
  const scaleLow = kind === "bar" ? Math.min(0, low) : low;
  const scaleHigh = kind === "bar" ? Math.max(0, high) : high;
  const width = 640;
  const height = 150;
  const x = (index: number) =>
    points.length === 1
      ? width / 2
      : 10 + (index / (points.length - 1)) * (width - 20);
  const barX = (index: number) =>
    12 + ((index + 0.5) / points.length) * (width - 24);
  const y = (value: number) =>
    scaleHigh === scaleLow
      ? height / 2
      : height -
        10 -
        ((value - scaleLow) / (scaleHigh - scaleLow)) * (height - 20);
  const polyline = points
    .map((point, index) => `${x(index)},${y(point.value)}`)
    .join(" ");
  const summary = `${label}: ${points.length} observations from ${points[0].label} ${formatNumber(points[0].value)} ${unit} to ${points.at(-1)?.label} ${formatNumber(points.at(-1)?.value ?? 0)} ${unit}; range ${formatNumber(low)} to ${formatNumber(high)} ${unit}. ${points.map((point) => `${point.label}: ${formatNumber(point.value)} ${unit}`).join("; ")}`;
  return (
    <figure style={{ ...sectionStyle, margin: 0 }}>
      <figcaption>
        <strong>{label}</strong>
        <div style={metaStyle}>
          {props.stringValue("source")
            ? `Source: ${props.stringValue("source")}`
            : ""}
          {props.stringValue("asOf")
            ? ` · As of ${props.stringValue("asOf")}`
            : ""}
        </div>
      </figcaption>
      <svg
        aria-label={summary}
        height="150"
        role="img"
        style={{ display: "block", marginInline: "auto", maxWidth: `${width}px` }}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        <line
          stroke="var(--ui-stroke-secondary)"
          x1="0"
          x2={width}
          y1={height - 1}
          y2={height - 1}
        />
        {kind === "bar" ? (
          points.map((point, index) => {
            const barWidth = Math.max(2, ((width - 20) / points.length) * 0.58);
            const baseline = y(0);
            const top = Math.min(y(point.value), baseline);
            const barHeight = Math.max(1, Math.abs(baseline - y(point.value)));
            return (
              <rect
                fill="var(--ui-accent-secondary)"
                key={point.label + index}
                height={barHeight}
                width={barWidth}
                x={barX(index) - barWidth / 2}
                y={top}
              />
            );
          })
        ) : (
          <polyline
            fill="none"
            points={polyline}
            stroke="var(--ui-accent-secondary)"
            strokeWidth="3"
          />
        )}
        {kind === "line"
          ? points.map((point, index) => (
              <circle
                cx={x(index)}
                cy={y(point.value)}
                fill="var(--ui-accent-secondary)"
                key={point.label + index}
                r="3.5"
              />
            ))
          : null}
      </svg>
      <div
        aria-label={summary}
        style={{
          display: "grid",
          gap: "0.25em 0.75em",
          gridTemplateColumns: `repeat(${points.length}, minmax(0, 1fr))`,
          marginInline: "auto",
          maxWidth: `${width}px`,
          ...metaStyle,
        }}
        role="list"
      >
        {points.map((point, index) => (
          <span key={`${point.label}:${index}`} role="listitem">
            {point.label}: {formatNumber(point.value)}
            {unit ? ` ${unit}` : ""}
          </span>
        ))}
      </div>
    </figure>
  );
}

function CommandBlock({
  component,
  stringValue: s,
  value: v,
}: WidgetRendererProps & { component: A2uiComponent }): React.ReactElement {
  const [copied, setCopied] = React.useState(false);
  const content = s("content");
  async function copy(): Promise<void> {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }
  return (
    <section style={sectionStyle}>
      <div
        style={{
          alignItems: "center",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.5em",
          justifyContent: "space-between",
        }}
      >
        <strong>{s("label", s("language", "Text"))}</strong>
        {v("copyable") === true ? (
          <Button
            onClick={() => {
              void copy();
            }}
            variant="outline"
          >
            {copied ? "Copied" : "Copy"}
          </Button>
        ) : null}
      </div>
      <pre
        style={{
          ...selectableStyle,
          background: "var(--ui-bg-secondary)",
          border: "1px solid var(--ui-stroke-tertiary)",
          color: "var(--ui-text-primary)",
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          margin: "0.55em 0 0",
          overflowX: "auto",
          padding: "0.6em 0.75em",
          tabSize: 2,
        }}
      >
        {content}
      </pre>
    </section>
  );
}

function ExtensionWidget(
  props: WidgetRendererProps & { component: A2uiComponent },
): React.ReactElement {
  const {
    component,
    renderChild,
    renderMedia,
    stringValue: s,
    numberValue: n,
    value: v,
  } = props;
  const [selected, setSelected] = React.useState(0);
  const [selectedRoom, setSelectedRoom] = React.useState(0);
  const [branch, setBranch] = React.useState(s("start"));
  const [sliderValue, setSliderValue] = React.useState(n("value"));
  const [after, setAfter] = React.useState(false);
  // DataTable: null = automatic. A wide surface shows the column table first (records stack three
  // times taller); a narrow one shows records. Choosing a presentation overrides this.
  const [comparePick, setCompare] = React.useState<boolean | null>(null);
  const [tableWide, setTableWide] = React.useState(false);
  const tableRef = React.useRef<HTMLElement | null>(null);
  React.useEffect(() => {
    const node = tableRef.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      setTableWide(width >= 560);
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const compare = comparePick ?? tableWide;
  switch (component.component) {
    case "CitationCard":
    case "SourceExcerpt":
      return (
        <article aria-label={s("title")} style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          <div>
            <span style={eyebrowStyle}>Source · {s("location")}</span>
            <div style={selectableStyle}>{s("source")}</div>
          </div>
          <div>
            <span style={eyebrowStyle}>Source excerpt</span>
            <blockquote
              style={{
                ...selectableStyle,
                borderInlineStart: "2px solid var(--ui-stroke-secondary)",
                color: "var(--ui-text-primary)",
                fontStyle: "normal",
                fontWeight: 400,
                margin: "0.25em 0",
                paddingInlineStart: "0.8em",
              }}
            >
              {s("excerpt")}
            </blockquote>
          </div>
          {s("finding") ? (
            <div>
              <span style={eyebrowStyle}>Finding</span>
              <div style={selectableStyle}>{s("finding")}</div>
            </div>
          ) : null}
          {actionChild(component, renderChild, props)}
        </article>
      );
    case "DraftReview":
      return (
        <article
          aria-label={`${s("title")}, draft not sent`}
          style={stackStyle}
        >
          <h3 style={titleStyle}>{s("title")}</h3>
          <Badge variant="muted">DRAFT / NOT SENT</Badge>
          <Field title="To" value={s("recipient")} />
          <Field title="Subject" value={s("subject")} />
          <Field title="Message" value={s("body")} />
          {actionChild(component, renderChild, props)}
        </article>
      );
    case "DataTable": {
      const columns = array(v("columns")).map((column) => str(column));
      const rows = array(v("rows"))
        .filter(Array.isArray)
        .map((row) => row.map((cell) => String(cell ?? "")));
      return (
        <section ref={tableRef} style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          <div style={metaStyle}>
            {rows.length} records / {columns.length} fields
          </div>
          <div
            aria-label="Table presentation"
            role="group"
            style={{ display: "flex", flexWrap: "wrap", gap: "0.4em" }}
          >
            <Button
              aria-pressed={!compare}
              onClick={() => setCompare(false)}
              variant={!compare ? "secondary" : "outline"}
            >
              Records
            </Button>
            <Button
              aria-pressed={compare}
              onClick={() => setCompare(true)}
              variant={compare ? "secondary" : "outline"}
            >
              Compare columns
            </Button>
          </div>
          {compare ? (
            <div
              style={{
                maxWidth: "100%",
                overflowX: "auto",
                overscrollBehaviorX: "contain",
              }}
            >
              <table
                style={{
                  borderCollapse: "collapse",
                  minWidth: "max-content",
                  width: "100%",
                }}
              >
                <thead>
                  <tr>
                    {columns.map((column, index) => (
                      <th
                        key={`${column}:${index}`}
                        scope="col"
                        style={tableHeadStyle}
                      >
                        {column}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <tr key={index}>
                      {columns.map((_, column) => (
                        <td key={column} style={tableCellStyle}>
                          <span style={selectableStyle}>
                            {row[column] ?? ""}
                          </span>
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div style={stackStyle}>
              {rows.map((row, index) => (
                <section
                  aria-label={`Record ${index + 1}`}
                  key={index}
                  style={{
                    borderBottom: "1px solid var(--ui-stroke-tertiary)",
                    padding: "0.5em 0",
                  }}
                >
                  <div style={eyebrowStyle}>Record {index + 1}</div>
                  {columns.map((column, columnIndex) => (
                    <Field
                      key={`${column}:${columnIndex}`}
                      title={column}
                      value={row[columnIndex] ?? ""}
                    />
                  ))}
                </section>
              ))}
            </div>
          )}
          {actionChild(component, renderChild, props)}
        </section>
      );
    }
    case "ChangeDiff": {
      const before = s("before").split("\n");
      const afterLines = s("after").split("\n");
      let prefix = 0;
      while (
        prefix < before.length &&
        prefix < afterLines.length &&
        before[prefix] === afterLines[prefix]
      )
        prefix++;
      let suffix = 0;
      while (
        suffix < before.length - prefix &&
        suffix < afterLines.length - prefix &&
        before[before.length - suffix - 1] ===
          afterLines[afterLines.length - suffix - 1]
      )
        suffix++;
      const removed = before.slice(prefix, before.length - suffix);
      const added = afterLines.slice(prefix, afterLines.length - suffix);
      return (
        <section style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          <Badge variant="muted">Preview only · not an applicable patch</Badge>
          <div
            aria-label="Changed lines"
            style={{
              ...stackStyle,
              fontFamily: "var(--font-mono, ui-monospace, monospace)",
            }}
            role="list"
          >
            {removed.map((line, index) => (
              <div
                key={`removed:${index}`}
                role="listitem"
                style={{
                  background: "var(--ui-diff-remove-background)",
                  borderInlineStart: "2px solid var(--ui-diff-remove-border)",
                  overflowWrap: "anywhere",
                  padding: "0.25em 0.5em",
                }}
              >
                − {line}
              </div>
            ))}
            {added.map((line, index) => (
              <div
                key={`added:${index}`}
                role="listitem"
                style={{
                  background: "var(--ui-diff-add-background)",
                  borderInlineStart: "2px solid var(--ui-diff-add-border)",
                  overflowWrap: "anywhere",
                  padding: "0.25em 0.5em",
                }}
              >
                + {line}
              </div>
            ))}
          </div>
          <details>
            <summary>Full before and after text</summary>
            <Field title="Before" value={s("before")} />
            <Field title="After" value={s("after")} />
          </details>
        </section>
      );
    }
    case "MultiSeriesChart":
      return <MultiSeriesChart {...props} />;
    case "Agenda":
    case "CalendarGrid": {
      const events = list(v("events"));
      const dates = [...new Set(events.map((event) => str(event.date)))].sort();
      const start = dates[0] ? parseIsoDate(dates[0]) : null;
      const choices =
        component.component === "CalendarGrid" && start
          ? Array.from({ length: 7 }, (_, index) =>
              isoDate(addDays(start, index)),
            )
          : dates;
      const activeDate =
        choices[Math.max(0, Math.min(selected, choices.length - 1))];
      const daysEvents = events.filter(
        (event) => str(event.date) === activeDate,
      );
      return (
        <section style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          <div style={metaStyle}>Timezone: {s("timezone")}</div>
          <div
            aria-label="Choose date"
            role="group"
            style={{ display: "flex", flexWrap: "wrap", gap: "0.35em" }}
          >
            {choices.map((date, index) => (
              <Button
                aria-pressed={selected === index}
                key={date}
                onClick={() => setSelected(index)}
                variant={selected === index ? "secondary" : "outline"}
              >
                {date}
              </Button>
            ))}
          </div>
          {daysEvents.length ? (
            daysEvents.map((event, index) => (
              <article
                key={`${event.date}:${event.time}:${index}`}
                style={{
                  borderBottom: "1px solid var(--ui-stroke-tertiary)",
                  padding: "0.4em 0",
                }}
              >
                <strong>
                  {str(event.time)} · {str(event.label)}
                </strong>
                <div style={textStyle}>{str(event.detail)}</div>
              </article>
            ))
          ) : (
            <div role="status" style={metaStyle}>
              No supplied events for this day.
            </div>
          )}
        </section>
      );
    }
    case "DecisionTree": {
      const nodes = list(v("nodes"));
      const currentId = branch || s("start");
      const current = nodes.find((node) => node.id === currentId);
      return current ? (
        <section style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          <div aria-live="polite">
            <strong>{str(current.label)}</strong>
            <div style={textStyle}>{str(current.detail)}</div>
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4em" }}>
            {list(current.options).map((option, index) => (
              <Button
                key={`${option.target}:${index}`}
                onClick={() => setBranch(str(option.target))}
                variant="outline"
              >
                {str(option.label)}
              </Button>
            ))}
          </div>
          {branch && branch !== s("start") ? (
            <Button onClick={() => setBranch(s("start"))} variant="text">
              Reset choices
            </Button>
          ) : null}
        </section>
      ) : (
        unavailable("DecisionTree path")
      );
    }
    case "ScenarioSlider": {
      const min = n("min");
      const max = n("max", min + 1);
      const current = Math.min(max, Math.max(min, sliderValue));
      const multiplier = n("multiplier");
      const offset = n("offset");
      const estimate = current * multiplier + offset;
      return (
        <section style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          <label
            style={{ display: "flex", flexDirection: "column", gap: "0.35em" }}
          >
            <span>
              {s("inputLabel")}: {formatNumber(current)}
            </span>
            <input
              aria-label={s("inputLabel")}
              max={max}
              min={min}
              onChange={(event) =>
                setSliderValue(Number(event.currentTarget.value))
              }
              style={{
                accentColor: "var(--ui-accent-secondary)",
                width: "100%",
              }}
              type="range"
              value={current}
            />
          </label>
          <strong>
            Estimate: {formatNumber(estimate)} {s("unit")}
          </strong>
          <div style={metaStyle}>
            Formula: input × {formatNumber(multiplier)} + {formatNumber(offset)}
          </div>
          <Field title="Assumptions" value={s("assumptions")} />
        </section>
      );
    }
    case "RelationshipMap":
      return (
        <RelationshipMap
          {...props}
          selected={selected}
          onSelect={setSelected}
        />
      );
    case "RoomMap":
      return (
        <RoomMap
          {...props}
          selected={selectedRoom}
          onSelect={setSelectedRoom}
        />
      );
    case "BeforeAfterViewer": {
      const mediaKey = after ? "afterMedia" : "beforeMedia";
      const mediaPath = s(mediaKey);
      const content = after ? s("after") : s("before");
      return (
        <section style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          <div
            aria-label="Before or after"
            role="group"
            style={{ display: "flex", flexWrap: "wrap", gap: "0.4em" }}
          >
            <Button
              aria-pressed={!after}
              onClick={() => setAfter(false)}
              variant={!after ? "secondary" : "outline"}
            >
              Before
            </Button>
            <Button
              aria-pressed={after}
              onClick={() => setAfter(true)}
              variant={after ? "secondary" : "outline"}
            >
              After
            </Button>
          </div>
          {mediaPath
            ? (renderMedia?.(mediaPath) ?? (
                <div role="status" style={metaStyle}>
                  Image unavailable.
                </div>
              ))
            : null}
          <div aria-live="polite" style={selectableStyle}>
            {content}
          </div>
        </section>
      );
    }
    case "JourneyMap":
      return (
        <section style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          <ol
            style={{
              borderInlineStart: "1px solid var(--ui-stroke-secondary)",
              listStyle: "none",
              margin: 0,
              padding: "0 0 0 1em",
            }}
          >
            {list(v("stages")).map((stage, index) => (
              <li
                key={`${stage.label}:${index}`}
                style={{
                  borderBottom: "1px solid var(--ui-stroke-tertiary)",
                  marginBottom: "0.5em",
                  padding: "0 0 0.65em 0.35em",
                }}
              >
                <div
                  style={{
                    alignItems: "center",
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "0.45em",
                  }}
                >
                  <Badge variant="outline">{index + 1}</Badge>
                  <strong>
                    {str(stage.time)} · {str(stage.label)}
                  </strong>
                </div>
                <div style={textStyle}>{str(stage.place)}</div>
                <div style={metaStyle}>Cost: {str(stage.cost)}</div>
                <div style={textStyle}>{str(stage.detail)}</div>
              </li>
            ))}
          </ol>
        </section>
      );
    case "EvidenceTrail":
      return (
        <section style={stackStyle}>
          <h3 style={titleStyle}>{s("title")}</h3>
          {list(v("items")).map((item, index) => (
            <article
              key={`${item.source}:${item.location}:${index}`}
              style={{
                borderBottom: "1px solid var(--ui-stroke-tertiary)",
                padding: "0.4em 0",
              }}
            >
              <div style={eyebrowStyle}>
                {str(item.source)} · {str(item.location)}
              </div>
              <Field title="Fact" value={str(item.fact)} />
              <Field title="Interpretation" value={str(item.interpretation)} />
              <Field title="Uncertainty" value={str(item.uncertainty)} />
            </article>
          ))}
        </section>
      );
    default:
      return unavailable(component.component);
  }
}

function MultiSeriesChart({
  component,
  value: v,
  stringValue: s,
}: WidgetRendererProps & { component: A2uiComponent }): React.ReactElement {
  const labels = array(v("labels")).map((label) => String(label));
  const series = list(v("series")).map((entry) => ({
    label: str(entry.label),
    values: array(entry.values).map((sample) => finite(sample)),
  }));
  const samples = series.flatMap((entry) => entry.values);
  const low = Math.min(...samples);
  const high = Math.max(...samples);
  const width = 640;
  const height = 170;
  const x = (index: number) =>
    labels.length < 2
      ? width / 2
      : 10 + (index * (width - 20)) / (labels.length - 1);
  const y = (sample: number) =>
    high === low
      ? height / 2
      : height - 12 - ((sample - low) / (high - low)) * (height - 24);
  const colors = [
    "var(--ui-accent-secondary)",
    "var(--ui-base)",
    "var(--ui-text-tertiary)",
    "var(--ui-green)",
  ];
  const summary = `${series.map((entry) => `${entry.label}: ${entry.values.map((sample, index) => `${labels[index]} ${formatNumber(sample)} ${s("unit")}`).join(", ")}`).join(". ")}`;
  return (
    <figure style={{ ...sectionStyle, margin: 0 }}>
      <figcaption>
        <h3 style={titleStyle}>{s("title")}</h3>
        <div style={metaStyle}>
          {labels[0]} → {labels.at(-1)} · {s("unit")} · range{" "}
          {formatNumber(low)}–{formatNumber(high)}
        </div>
      </figcaption>
      <svg
        aria-label={summary}
        height={height}
        role="img"
        style={{ display: "block", maxWidth: "100%" }}
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
      >
        <line
          stroke="var(--ui-stroke-secondary)"
          x1="0"
          x2={width}
          y1={height - 2}
          y2={height - 2}
        />
        {series.map((entry, seriesIndex) => (
          <g key={`${entry.label}:${seriesIndex}`}>
            <polyline
              fill="none"
              points={entry.values
                .map((sample, index) => `${x(index)},${y(sample)}`)
                .join(" ")}
              stroke={colors[seriesIndex % colors.length]}
              strokeWidth="3"
            />
            {entry.values.map((sample, index) => (
              <circle
                cx={x(index)}
                cy={y(sample)}
                fill={colors[seriesIndex % colors.length]}
                key={`${index}:${sample}`}
                r="3"
              />
            ))}
          </g>
        ))}
      </svg>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4em 1em" }}>
        {series.map((entry, index) => (
          <Badge key={`${entry.label}:${index}`} variant="outline">
            <span
              aria-hidden="true"
              style={{ color: colors[index % colors.length] }}
            >
              ●
            </span>{" "}
            {entry.label}
          </Badge>
        ))}
      </div>
      {series.map((entry, index) => (
        <Field
          key={`${entry.label}:${index}`}
          title={entry.label}
          value={entry.values
            .map(
              (sample, valueIndex) =>
                `${labels[valueIndex]}: ${formatNumber(sample)} ${s("unit")}`,
            )
            .join("\n")}
        />
      ))}
    </figure>
  );
}

function RelationshipMap({
  component,
  value: v,
  stringValue: s,
  selected,
  onSelect,
}: WidgetRendererProps & {
  component: A2uiComponent;
  selected: number;
  onSelect: (index: number) => void;
}): React.ReactElement {
  const nodes = list(v("nodes"));
  const edges = list(v("edges"));
  // Keep the full node radius plus the selected stroke inside the viewBox.
  const radius = 90;
  const center = 130;
  const positions = nodes.map((_, index) => {
    const angle =
      -Math.PI / 2 + (2 * Math.PI * index) / Math.max(1, nodes.length);
    return {
      x: center + radius * Math.cos(angle),
      y: center + radius * Math.sin(angle),
    };
  });
  const indexById = new Map(nodes.map((node, index) => [str(node.id), index]));
  const current = nodes[Math.min(selected, nodes.length - 1)];
  const edgeLabel = (edge: Record<string, unknown>) =>
    `${str(nodes[indexById.get(str(edge.source)) ?? -1]?.label)} → ${str(nodes[indexById.get(str(edge.target)) ?? -1]?.label)}: ${str(edge.label)}`;
  return (
    <section style={stackStyle}>
      <h3 style={titleStyle}>{s("title")}</h3>
      <svg
        aria-label="Relationship map diagram"
        height="270"
        role="img"
        style={{ display: "block", maxWidth: "100%" }}
        viewBox="0 0 260 260"
        width="100%"
      >
        <defs>
          <marker
            id={`arrow-${component.id}`}
            markerHeight="6"
            markerWidth="6"
            orient="auto"
            refX="5"
            refY="3"
          >
            <path d="M0,0 L6,3 L0,6 Z" fill="var(--ui-text-secondary)" />
          </marker>
        </defs>
        {edges.map((edge, index) => {
          const from = positions[indexById.get(str(edge.source)) ?? -1];
          const to = positions[indexById.get(str(edge.target)) ?? -1];
          return from && to ? (
            <line
              key={`${edge.source}:${edge.target}:${index}`}
              markerEnd={`url(#arrow-${component.id})`}
              stroke="var(--ui-stroke-secondary)"
              x1={from.x}
              x2={to.x}
              y1={from.y}
              y2={to.y}
            />
          ) : null;
        })}
        {nodes.map((node, index) => (
          <g key={`${node.id}:${index}`}>
            <circle
              cx={positions[index].x}
              cy={positions[index].y}
              fill="var(--ui-bg-secondary)"
              r="27"
              stroke={
                selected === index
                  ? "var(--ui-accent-secondary)"
                  : "var(--ui-stroke-secondary)"
              }
              strokeWidth={selected === index ? 3 : 1.5}
            />
            <text
              fill="var(--ui-text-primary)"
              fontSize="11"
              textAnchor="middle"
              x={positions[index].x}
              y={positions[index].y + 4}
            >
              {shorten(str(node.label), 12)}
            </text>
          </g>
        ))}
      </svg>
      <div
        aria-label="Relationship nodes"
        role="group"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.35em" }}
      >
        {nodes.map((node, index) => (
          <Button
            aria-pressed={selected === index}
            key={`${node.id}:${index}`}
            onClick={() => onSelect(index)}
            variant={selected === index ? "secondary" : "outline"}
          >
            {str(node.label)}
          </Button>
        ))}
      </div>
      {current ? (
        <Field title={str(current.label)} value={str(current.detail)} />
      ) : null}
      <div aria-label="Relationship details" style={stackStyle} role="list">
        {edges.map((edge, index) => (
          <div key={index} role="listitem" style={metaStyle}>
            {edgeLabel(edge)}
          </div>
        ))}
      </div>
    </section>
  );
}

function RoomMap({
  component,
  value: v,
  stringValue: s,
  renderMedia,
  selected,
  onSelect,
}: WidgetRendererProps & {
  component: A2uiComponent;
  selected: number;
  onSelect: (index: number) => void;
}): React.ReactElement {
  const rooms = list(v("rooms"));
  const room = rooms[Math.min(selected, rooms.length - 1)];
  return (
    <section style={stackStyle}>
      <h3 style={titleStyle}>{s("title")}</h3>
      <div style={metaStyle}>{s("provenance")}</div>
      {s("backgroundMedia")
        ? (renderMedia?.(s("backgroundMedia")) ?? (
            <div role="status" style={metaStyle}>
              Reference image unavailable.
            </div>
          ))
        : null}
      <svg
        aria-label="Supplied normalized room geometry"
        height="260"
        role="img"
        style={{
          display: "block",
          maxWidth: "100%",
          outline: "1px solid var(--ui-stroke-secondary)",
        }}
        viewBox="0 0 400 260"
        width="100%"
      >
        {rooms.map((item, index) => (
          <g key={`${item.id}:${index}`}>
            <rect
              fill="var(--ui-bg-secondary)"
              height={Math.max(1, finite(item.height) * 260)}
              stroke={
                selected === index
                  ? "var(--ui-accent-secondary)"
                  : "var(--ui-stroke-secondary)"
              }
              strokeWidth={selected === index ? 3 : 1}
              width={Math.max(1, finite(item.width) * 400)}
              x={finite(item.x) * 400}
              y={finite(item.y) * 260}
            />
            <text
              fill="var(--ui-text-primary)"
              fontSize="13"
              textAnchor="middle"
              x={(finite(item.x) + finite(item.width) / 2) * 400}
              y={(finite(item.y) + finite(item.height) / 2) * 260}
            >
              {shorten(str(item.label), 22)}
            </text>
          </g>
        ))}
      </svg>
      <div
        aria-label="Rooms"
        role="group"
        style={{ display: "flex", flexWrap: "wrap", gap: "0.35em" }}
      >
        {rooms.map((item, index) => (
          <Button
            aria-pressed={selected === index}
            key={`${item.id}:${index}`}
            onClick={() => onSelect(index)}
            variant={selected === index ? "secondary" : "outline"}
          >
            {index + 1}. {str(item.label)}
          </Button>
        ))}
      </div>
      {room ? <Field title={str(room.label)} value={str(room.detail)} /> : null}
    </section>
  );
}

function actionChild(
  component: A2uiComponent,
  renderChild: (id: string) => React.ReactNode,
  props: WidgetRendererProps,
): React.ReactNode {
  if (
    !["CitationCard", "DataTable", "DraftReview"].includes(component.component)
  )
    return null;
  const action = props.value("actionChild");
  return typeof action === "string" ? (
    <div
      style={{
        borderTop: "1px solid var(--ui-stroke-tertiary)",
        paddingTop: "0.65em",
      }}
    >
      {renderChild(action)}
    </div>
  ) : null;
}

function legacyActionChild(
  component: A2uiComponent,
  renderChild: (id: string) => React.ReactNode,
  props: WidgetRendererProps,
): React.ReactNode {
  if (!["ActionCallout", "ArtifactTile"].includes(component.component))
    return null;
  const action = props.value("actionChild");
  return typeof action === "string" ? (
    <div style={{ paddingTop: "0.45em" }}>{renderChild(action)}</div>
  ) : null;
}

function Field({
  title,
  value,
}: {
  title: string;
  value: string;
}): React.ReactElement {
  return (
    <div style={{ minWidth: 0 }}>
      <div style={eyebrowStyle}>{title}</div>
      <div style={selectableStyle}>{value}</div>
    </div>
  );
}

function unavailable(name: string): React.ReactElement {
  return (
    <div role="status" style={{ color: "var(--ui-text-secondary)" }}>
      {name} is unavailable in this renderer.
    </div>
  );
}

const titleStyle: React.CSSProperties = {
  fontSize: "calc(var(--kaizen-text-base, 0.977em) * 1.075)",
  fontWeight: 650,
  lineHeight: 1.35,
  margin: 0,
  overflowWrap: "anywhere",
};
const eyebrowStyle: React.CSSProperties = {
  color: "var(--ui-text-secondary)",
  fontSize: "var(--kaizen-text-caption, 0.8em)",
  fontWeight: 600,
  letterSpacing: "0.025em",
  marginBottom: "0.2em",
};
const tableHeadStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--ui-stroke-secondary)",
  fontSize: "var(--kaizen-text-small, 0.9em)",
  fontWeight: 650,
  padding: "0.55em 0.75em",
  textAlign: "left",
  whiteSpace: "nowrap",
};
const tableCellStyle: React.CSSProperties = {
  borderBottom: "1px solid var(--ui-stroke-tertiary)",
  maxWidth: "28em",
  minWidth: "9em",
  padding: "0.55em 0.75em",
  verticalAlign: "top",
};

function badgeVariant(
  state: string,
):
  | "default"
  | "muted"
  | "success"
  | "warn"
  | "destructive"
  | "outline"
  | "solid" {
  if (["ok", "success", "done", "complete"].includes(state)) return "success";
  if (
    ["warning", "attention", "warn", "blocked", "high", "urgent"].includes(
      state,
    )
  )
    return "warn";
  if (["error", "failed"].includes(state)) return "destructive";
  if (["current", "in_progress", "primary"].includes(state)) return "default";
  return "muted";
}

function list(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value)
    ? value.filter(
        (item): item is Record<string, unknown> =>
          !!item && typeof item === "object" && !Array.isArray(item),
      )
    : [];
}

function array(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function str(value: unknown, fallback = ""): string {
  return value == null ? fallback : String(value);
}

function finite(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function formatNumber(value: number): string {
  return Number.isInteger(value)
    ? String(value)
    : String(Number(value.toPrecision(5)));
}

function shorten(value: string, maximum: number): string {
  return value.length > maximum ? `${value.slice(0, maximum - 1)}…` : value;
}

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}
