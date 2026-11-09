import * as React from "react";
import {
  Badge,
  Button,
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  Input,
} from "@hermes/plugin-sdk";
import type { A2uiComponent, A2uiSurface, UiAction } from "../types";
import { resolveBinding, updateDataModel } from "../validation/bindings";
import { resolveActionContext } from "../interactions/serialize";
import { renderCatalogWidget } from "./widgets";
import { CatalogIcon } from "./catalog-icons";

export const A2UI_RENDERED_COMPONENTS = [
  "Text",
  "Icon",
  "Divider",
  "Row",
  "Column",
  "List",
  "Card",
  "Tabs",
  "Modal",
  "Button",
  "TextField",
  "CheckBox",
  "ChoicePicker",
  "Slider",
  "DateTimeInput",
  "StatusBadge",
  "MetricTile",
  "MiniChart",
  "InfoRow",
  "StepRail",
  "ActionCallout",
  "ArtifactTile",
  "BotBadge",
  "ExpandableSection",
  "ProgressMeter",
  "ActivityFeed",
  "ScheduleTile",
  "MessagePreview",
  "CommandBlock",
  "TaskTile",
  "KeyValueGrid",
  "ComparisonCard",
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
] as const;

export interface A2uiSurfaceViewProps {
  surface: A2uiSurface;
  disabled?: boolean;
  onInteraction?: (action: UiAction) => Promise<void>;
  renderMedia?: (path: string) => React.ReactNode;
}

interface RenderContextValue {
  surface: A2uiSurface;
  model: Record<string, unknown>;
  setModel: React.Dispatch<React.SetStateAction<Record<string, unknown>>>;
  disabled: boolean;
  onInteraction?: (action: UiAction) => Promise<void>;
  renderMedia?: (path: string) => React.ReactNode;
  sendLocks: React.MutableRefObject<Set<string>>;
}

const RenderContext = React.createContext<RenderContextValue | null>(null);

const rootStyle: React.CSSProperties = {
  color: "var(--ui-text-primary)",
  font: "inherit",
  minWidth: 0,
  width: "100%",
};

/** Render one already validated A2UI v0.9 surface. */
export function A2uiSurfaceView({
  surface,
  disabled = false,
  onInteraction,
  renderMedia,
}: A2uiSurfaceViewProps): React.ReactElement {
  const [model, setModel] = React.useState(surface.dataModel);
  const sendLocks = React.useRef(new Set<string>());

  React.useEffect(() => {
    setModel(surface.dataModel);
    sendLocks.current.clear();
  }, [surface.surfaceId, surface.dataModel]);

  const context = React.useMemo<RenderContextValue>(
    () => ({
      surface,
      model,
      setModel,
      disabled,
      onInteraction,
      renderMedia,
      sendLocks,
    }),
    [surface, model, disabled, onInteraction, renderMedia],
  );

  if (!surface.components.root) {
    return (
      <div role="status" style={rootStyle}>
        A2UI surface has no root component.
      </div>
    );
  }

  return (
    <RenderContext.Provider value={context}>
      <section
        aria-label="Hermes visual response"
        data-a2ui-surface={surface.surfaceId}
        style={rootStyle}
      >
        <Node id="root" />
      </section>
    </RenderContext.Provider>
  );
}

interface ComponentErrorBoundaryProps {
  componentName: string;
  children: React.ReactNode;
}

interface ComponentErrorBoundaryState {
  failed: boolean;
}

class ComponentErrorBoundary extends React.Component<
  ComponentErrorBoundaryProps,
  ComponentErrorBoundaryState
> {
  state: ComponentErrorBoundaryState = { failed: false };

  static getDerivedStateFromError(): ComponentErrorBoundaryState {
    return { failed: true };
  }

  render(): React.ReactNode {
    if (this.state.failed) {
      return (
        <div role="status" style={{ color: "var(--ui-text-secondary)" }}>
          {this.props.componentName} could not be displayed.
        </div>
      );
    }
    return this.props.children;
  }
}

function useRenderContext(): RenderContextValue {
  const value = React.useContext(RenderContext);
  if (!value)
    throw new Error("A2UI nodes must be rendered inside A2uiSurfaceView");
  return value;
}

function raw(component: A2uiComponent, key: string): unknown {
  return component[key];
}

function value(
  component: A2uiComponent,
  key: string,
  model: Record<string, unknown>,
  fallback?: unknown,
): unknown {
  const resolved = resolveDynamic(raw(component, key), model);
  return resolved === undefined ? fallback : resolved;
}

function resolveDynamic(
  input: unknown,
  model: Record<string, unknown>,
): unknown {
  if (isBinding(input)) return resolveBinding(input, model);
  if (Array.isArray(input))
    return input.map((item) => resolveDynamic(item, model));
  if (isRecord(input)) {
    return Object.fromEntries(
      Object.entries(input).map(([key, child]) => [
        key,
        resolveDynamic(child, model),
      ]),
    );
  }
  return input;
}

function stringValue(
  component: A2uiComponent,
  key: string,
  model: Record<string, unknown>,
  fallback = "",
): string {
  const result = value(component, key, model, fallback);
  return result == null ? fallback : String(result);
}

function numberValue(
  component: A2uiComponent,
  key: string,
  model: Record<string, unknown>,
  fallback = 0,
): number {
  const result = value(component, key, model, fallback);
  return typeof result === "number" && Number.isFinite(result)
    ? result
    : fallback;
}

function childId(
  component: A2uiComponent,
  key: string,
  model: Record<string, unknown>,
): string | null {
  const candidate = value(component, key, model);
  return typeof candidate === "string" ? candidate : null;
}

function nodeList(
  component: A2uiComponent,
  key: string,
  model: Record<string, unknown>,
): string[] {
  const candidates = value(component, key, model);
  return Array.isArray(candidates)
    ? candidates.filter((item): item is string => typeof item === "string")
    : [];
}

function childWeight(
  component: A2uiComponent,
  model: Record<string, unknown>,
): number {
  const result = resolveBinding(component.weight, model);
  return typeof result === "number" && Number.isFinite(result) && result > 0
    ? result
    : 1;
}

function alignValue(value: unknown): React.CSSProperties["alignItems"] {
  switch (value) {
    case "start":
      return "flex-start";
    case "center":
      return "center";
    case "end":
      return "flex-end";
    case "stretch":
      return "stretch";
    case "baseline":
      return "baseline";
    default:
      return "stretch";
  }
}

function justifyValue(value: unknown): React.CSSProperties["justifyContent"] {
  switch (value) {
    case "center":
      return "center";
    case "end":
      return "flex-end";
    case "spaceBetween":
      return "space-between";
    case "spaceAround":
      return "space-around";
    case "spaceEvenly":
      return "space-evenly";
    default:
      return "flex-start";
  }
}

function Node({ id }: { id: string }): React.ReactElement {
  const context = useRenderContext();
  const component = context.surface.components[id];
  if (!component)
    return <span role="status">Unavailable component reference.</span>;
  return (
    <ComponentErrorBoundary
      key={`${id}:${component.component}`}
      componentName={component.component}
    >
      <NodeContent id={id} component={component} />
    </ComponentErrorBoundary>
  );
}

function NodeContent({
  id,
  component,
}: {
  id: string;
  component: A2uiComponent;
}): React.ReactElement {
  const context = useRenderContext();

  const children = (ids: string[], row = false) =>
    ids.map((child) => (
      <div
        key={child}
        data-a2ui-row-button={
          row && context.surface.components[child]?.component === "Button"
            ? ""
            : undefined
        }
        style={{
          display:
            row && context.surface.components[child]?.component === "Button"
              ? "flex"
              : undefined,
          flex: row
            ? childWeight(
                context.surface.components[child] ?? {
                  id: child,
                  component: "Text",
                },
                context.model,
              )
            : undefined,
          minWidth: 0,
        }}
      >
        <Node id={child} />
      </div>
    ));

  switch (component.component) {
    case "Text": {
      const variant = stringValue(component, "variant", context.model, "body");
      const tag =
        (
          {
            h1: "h1",
            h2: "h2",
            h3: "h3",
            h4: "h4",
            h5: "h5",
            caption: "p",
          } as Record<string, keyof React.JSX.IntrinsicElements>
        )[variant] ?? "p";
      const size =
        (
          {
            h1: "1.5em",
            h2: "1.32em",
            h3: "1.16em",
            h4: "1.08em",
            h5: "1em",
            caption: "var(--kaizen-text-small, 0.85em)",
          } as Record<string, string>
        )[variant] ?? "1em";
      return React.createElement(
        tag,
        {
          style: {
            fontSize: size,
            fontWeight: variant.startsWith("h") ? 600 : undefined,
            lineHeight: 1.45,
            margin: 0,
            minWidth: 0,
            overflowWrap: "anywhere",
            whiteSpace: "pre-wrap",
          },
        },
        stringValue(component, "text", context.model),
      );
    }
    case "Icon":
      return (
        <span
          aria-label={`Icon: ${stringValue(component, "name", context.model)}`}
          role="img"
          style={{
            color: "var(--ui-text-secondary)",
            display: "inline-block",
            minWidth: "1.25em",
          }}
        >
          <CatalogIcon name={stringValue(component, "name", context.model)} />
        </span>
      );
    case "Divider":
      return (
        <div
          aria-hidden="true"
          style={{
            background: "var(--ui-stroke-tertiary)",
            flex: "none",
            height:
              stringValue(component, "axis", context.model) === "vertical"
                ? "1.5em"
                : "1px",
            margin:
              stringValue(component, "axis", context.model) === "vertical"
                ? "0 0.5em"
                : "0.5em 0",
            width:
              stringValue(component, "axis", context.model) === "vertical"
                ? "1px"
                : "100%",
          }}
        />
      );
    case "Column":
      return (
        <div
          style={{
            alignItems: alignValue(value(component, "align", context.model)),
            display: "flex",
            flexDirection: "column",
            gap: "0.75em",
            justifyContent: justifyValue(
              value(component, "justify", context.model),
            ),
            minWidth: 0,
            width: "100%",
          }}
        >
          {children(nodeList(component, "children", context.model))}
        </div>
      );
    case "Row":
      return (
        <div
          style={{
            alignItems: alignValue(value(component, "align", context.model)),
            display: "flex",
            flexDirection: "row",
            flexWrap: "wrap",
            gap: "0.75em",
            justifyContent: justifyValue(
              value(component, "justify", context.model),
            ),
            minWidth: 0,
            width: "100%",
          }}
        >
          {children(nodeList(component, "children", context.model), true)}
        </div>
      );
    case "List": {
      const horizontal =
        stringValue(component, "direction", context.model, "vertical") ===
        "horizontal";
      return (
        <div
          role="list"
          style={{
            alignItems: alignValue(value(component, "align", context.model)),
            display: "flex",
            flexDirection: horizontal ? "row" : "column",
            flexWrap: horizontal ? "wrap" : undefined,
            gap: "0.625em",
            minWidth: 0,
          }}
        >
          {children(nodeList(component, "children", context.model))}
        </div>
      );
    }
    case "Card": {
      const child = childId(component, "child", context.model);
      return (
        <div
          style={{
            border: "1px solid var(--ui-stroke-tertiary)",
            minWidth: 0,
            padding: "0.875em",
          }}
        >
          {child ? <Node id={child} /> : null}
        </div>
      );
    }
    case "Tabs":
      return <TabsWidget component={component} />;
    case "Modal":
      return <ModalWidget component={component} />;
    case "Button":
      return <ActionButton component={component} />;
    case "TextField":
      return <TextField component={component} />;
    case "CheckBox":
      return <CheckBox component={component} />;
    case "ChoicePicker":
      return <ChoicePicker component={component} />;
    case "Slider":
      return <BoundSlider component={component} />;
    case "DateTimeInput":
      return <DateTimeInput component={component} />;
    default:
      return renderCatalogWidget(component, {
        renderChild: (child) => <Node id={child} />,
        value: (key, fallback) =>
          value(component, key, context.model, fallback),
        stringValue: (key, fallback) =>
          stringValue(component, key, context.model, fallback),
        numberValue: (key, fallback) =>
          numberValue(component, key, context.model, fallback),
        setBoundValue: (key, next) =>
          setBoundValue(context, component, key, next),
        renderMedia: context.renderMedia,
      });
  }
}

function setBoundValue(
  context: RenderContextValue,
  component: A2uiComponent,
  key: string,
  nextValue: unknown,
): void {
  const { model, setModel } = context;
  const bound = raw(component, key);
  if (!isBinding(bound)) return;
  setModel((current) =>
    updateDataModel(current ?? model, bound.path, nextValue),
  );
}

function isBinding(input: unknown): input is { path: string } {
  return (
    !!input &&
    typeof input === "object" &&
    !Array.isArray(input) &&
    Object.keys(input).length === 1 &&
    typeof (input as { path?: unknown }).path === "string"
  );
}

function ActionButton({
  component,
}: {
  component: A2uiComponent;
}): React.ReactElement {
  const context = useRenderContext();
  const child = childId(component, "child", context.model);
  const action = value(component, "action", context.model) as
    { event?: { name?: unknown; context?: unknown } } | undefined;
  const event = action?.event;
  const name = typeof event?.name === "string" ? event.name : null;
  const lockKey = `${context.surface.surfaceId}:${component.id}`;
  const inRow = Object.values(context.surface.components).some(
    (parent) =>
      parent.component === "Row" &&
      Array.isArray(parent.children) &&
      parent.children.includes(component.id),
  );
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const variant = stringValue(component, "variant", context.model, "default");
  const styleVariant =
    variant === "primary"
      ? "default"
      : variant === "borderless"
        ? "text"
        : "outline";

  async function activate(): Promise<void> {
    if (
      !name ||
      !context.onInteraction ||
      context.disabled ||
      pending ||
      context.sendLocks.current.has(lockKey)
    )
      return;
    context.sendLocks.current.add(lockKey);
    setPending(true);
    setError(null);
    try {
      const rawContext = event?.context;
      const resolvedContext = isRecord(rawContext)
        ? resolveActionContext(rawContext, context.model)
        : {};
      await context.onInteraction({
        surfaceId: context.surface.surfaceId,
        sourceComponentId: component.id,
        name,
        context: resolvedContext,
      });
    } catch {
      setError("Could not send this request. You can try again.");
    } finally {
      context.sendLocks.current.delete(lockKey);
      setPending(false);
    }
  }

  return (
    <span
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "0.3em",
        maxWidth: "100%",
        // A button that is a direct child of a Row fills its cell, so paired actions read as one control group
        ...(inRow ? { flex: "1 1 auto", width: "100%" } : {}),
      }}
    >
      <Button
        aria-busy={pending || undefined}
        style={inRow ? { width: "100%", justifyContent: "center" } : undefined}
        disabled={
          context.disabled || pending || !name || !context.onInteraction
        }
        onClick={() => {
          void activate();
        }}
        variant={styleVariant as "default" | "outline" | "text"}
      >
        {child ? <Node id={child} /> : "Continue in chat"}
      </Button>
      {error ? (
        <span
          role="status"
          style={{ color: "var(--ui-text-secondary)", fontSize: "var(--kaizen-text-small, 0.85em)" }}
        >
          {error}
        </span>
      ) : null}
    </span>
  );
}

function TextField({
  component,
}: {
  component: A2uiComponent;
}): React.ReactElement {
  const context = useRenderContext();
  const label = stringValue(component, "label", context.model, "Text");
  const initial = value(component, "value", context.model, "");
  const [local, setLocal] = React.useState(
    initial == null ? "" : String(initial),
  );
  const binding = isBinding(component.value);
  const current = binding ? String(initial ?? "") : local;
  const variant = stringValue(component, "variant", context.model, "shortText");
  const inputType =
    variant === "number"
      ? "number"
      : variant === "obscured"
        ? "password"
        : "text";
  return (
    <label style={fieldLabelStyle}>
      <span>{label}</span>
      {variant === "longText" ? (
        <textarea
          aria-label={label}
          onChange={(event) =>
            binding
              ? setBoundValue(
                  context,
                  component,
                  "value",
                  event.currentTarget.value,
                )
              : setLocal(event.currentTarget.value)
          }
          style={nativeFieldStyle}
          value={current}
        />
      ) : (
        <Input
          aria-label={label}
          onChange={(event) =>
            binding
              ? setBoundValue(
                  context,
                  component,
                  "value",
                  inputType === "number" && event.currentTarget.value !== ""
                    ? Number(event.currentTarget.value)
                    : event.currentTarget.value,
                )
              : setLocal(event.currentTarget.value)
          }
          pattern={
            typeof component.validationRegexp === "string"
              ? component.validationRegexp
              : undefined
          }
          style={fieldBorderStyle}
          type={inputType}
          value={current}
        />
      )}
    </label>
  );
}

function CheckBox({
  component,
}: {
  component: A2uiComponent;
}): React.ReactElement {
  const context = useRenderContext();
  const initial = value(component, "value", context.model, false);
  const [local, setLocal] = React.useState(initial === true);
  const checked = isBinding(component.value) ? initial === true : local;
  return (
    <label
      style={{
        alignItems: "center",
        display: "inline-flex",
        gap: "0.5em",
        minHeight: "2.5em",
      }}
    >
      <input
        aria-label={stringValue(component, "label", context.model, "Option")}
        checked={checked}
        onChange={(event) =>
          isBinding(component.value)
            ? setBoundValue(
                context,
                component,
                "value",
                event.currentTarget.checked,
              )
            : setLocal(event.currentTarget.checked)
        }
        style={{ accentColor: "var(--ui-accent-secondary)" }}
        type="checkbox"
      />
      <span>{stringValue(component, "label", context.model, "Option")}</span>
    </label>
  );
}

function ChoicePicker({
  component,
}: {
  component: A2uiComponent;
}): React.ReactElement {
  const context = useRenderContext();
  const options = (
    value(component, "options", context.model, []) as unknown[]
  ).filter(isRecord);
  const initial = value(component, "value", context.model, []);
  const [local, setLocal] = React.useState<string[]>(
    Array.isArray(initial) ? initial.map(String) : [],
  );
  const selected = isBinding(component.value)
    ? Array.isArray(initial)
      ? initial.map(String)
      : []
    : local;
  const multiple =
    stringValue(component, "variant", context.model, "mutuallyExclusive") ===
    "multipleSelection";
  const label = stringValue(
    component,
    "label",
    context.model,
    "Choose an option",
  );
  function toggle(option: string): void {
    const next = multiple
      ? selected.includes(option)
        ? selected.filter((item) => item !== option)
        : [...selected, option]
      : [option];
    if (isBinding(component.value))
      setBoundValue(context, component, "value", next);
    else setLocal(next);
  }
  return (
    <fieldset style={{ border: 0, margin: 0, minWidth: 0, padding: 0 }}>
      <legend style={{ marginBottom: "0.4em" }}>{label}</legend>
      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35em 0.85em" }}>
        {options.map((option, index) => {
          const optionValue = String(option.value ?? "");
          return (
            <label
              key={`${optionValue}:${index}`}
              style={{
                alignItems: "center",
                display: "inline-flex",
                gap: "0.4em",
                minHeight: "2.3em",
              }}
            >
              <input
                checked={selected.includes(optionValue)}
                onChange={() => toggle(optionValue)}
                type={multiple ? "checkbox" : "radio"}
                name={multiple ? undefined : component.id}
                style={{ accentColor: "var(--ui-accent-secondary)" }}
              />
              <span>{String(option.label ?? optionValue)}</span>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
}

function BoundSlider({
  component,
}: {
  component: A2uiComponent;
}): React.ReactElement {
  const context = useRenderContext();
  const initial = numberValue(component, "value", context.model);
  const [local, setLocal] = React.useState(initial);
  const current = isBinding(component.value)
    ? numberValue(component, "value", context.model)
    : local;
  const min = numberValue(component, "min", context.model, 0);
  const max = numberValue(component, "max", context.model, 100);
  const label = stringValue(component, "label", context.model, "Value");
  return (
    <label style={fieldLabelStyle}>
      <span>
        {label}: {current}
      </span>
      <input
        aria-label={label}
        max={max}
        min={min}
        onChange={(event) =>
          isBinding(component.value)
            ? setBoundValue(
                context,
                component,
                "value",
                Number(event.currentTarget.value),
              )
            : setLocal(Number(event.currentTarget.value))
        }
        style={{ accentColor: "var(--ui-accent-secondary)", width: "100%" }}
        type="range"
        value={Math.min(max, Math.max(min, current))}
      />
    </label>
  );
}

function DateTimeInput({
  component,
}: {
  component: A2uiComponent;
}): React.ReactElement {
  const context = useRenderContext();
  const initial = value(component, "value", context.model, "");
  const [local, setLocal] = React.useState(String(initial ?? ""));
  const dateEnabled =
    value(component, "enableDate", context.model, true) !== false;
  const timeEnabled =
    value(component, "enableTime", context.model, false) === true;
  const type =
    dateEnabled && timeEnabled
      ? "datetime-local"
      : timeEnabled
        ? "time"
        : "date";
  const current = isBinding(component.value) ? String(initial ?? "") : local;
  const inputValue = type === "datetime-local" ? current.slice(0, 16) : current;
  const label = stringValue(component, "label", context.model, "Date");
  const max = value(component, "max", context.model);
  const min = value(component, "min", context.model);
  return (
    <label style={fieldLabelStyle}>
      <span>{label}</span>
      <Input
        aria-label={label}
        max={typeof max === "string" ? max : undefined}
        min={typeof min === "string" ? min : undefined}
        onChange={(event) =>
          isBinding(component.value)
            ? setBoundValue(
                context,
                component,
                "value",
                event.currentTarget.value,
              )
            : setLocal(event.currentTarget.value)
        }
        style={fieldBorderStyle}
        type={type}
        value={inputValue}
      />
    </label>
  );
}

function TabsWidget({
  component,
}: {
  component: A2uiComponent;
}): React.ReactElement {
  const context = useRenderContext();
  const tabs = (
    value(component, "tabs", context.model, []) as unknown[]
  ).filter(isRecord);
  const active = value(component, "activeTab", context.model, 0);
  const [selected, setSelected] = React.useState(
    typeof active === "number" ? active : 0,
  );
  const index = Math.max(0, Math.min(tabs.length - 1, selected));
  return (
    <div style={{ minWidth: 0 }}>
      <div
        aria-label="Sections"
        role="tablist"
        style={{
          borderBottom: "1px solid var(--ui-stroke-tertiary)",
          display: "flex",
          flexWrap: "wrap",
          gap: "0.4em",
        }}
      >
        {tabs.map((tab, i) => (
          <Button
            aria-selected={i === index}
            key={`${String(tab.label)}:${i}`}
            onClick={() => setSelected(i)}
            role="tab"
            variant={i === index ? "secondary" : "text"}
          >
            {String(tab.label ?? `Tab ${i + 1}`)}
          </Button>
        ))}
      </div>
      <div role="tabpanel" style={{ minWidth: 0, paddingTop: "0.65em" }}>
        {typeof tabs[index]?.content === "string" ? (
          <Node id={String(tabs[index].content)} />
        ) : null}
      </div>
    </div>
  );
}

function ModalWidget({
  component,
}: {
  component: A2uiComponent;
}): React.ReactElement {
  const { model, disabled } = useRenderContext();
  const trigger = childId(component, "trigger", model);
  const content = childId(component, "content", model);
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button disabled={disabled} variant="secondary">
          {trigger ? <TriggerLabel id={trigger} /> : "Open"}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="sr-only">
            {trigger ? <TriggerLabel id={trigger} /> : "Dialog"}
          </DialogTitle>
        </DialogHeader>
        {content ? <Node id={content} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function TriggerLabel({ id }: { id: string }): React.ReactElement {
  const { surface } = useRenderContext();
  const component = surface.components[id];
  if (component?.component === "Button" && typeof component.child === "string")
    return <Node id={component.child} />;
  return <Node id={id} />;
}

const fieldLabelStyle: React.CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "0.3em",
  minWidth: 0,
  width: "100%",
};
// Text-like fields need an edge that reads against the card in both modes (the host input's own stroke is
// close to invisible on dark cards).
const FIELD_BORDER =
  "1px solid color-mix(in srgb, var(--ui-text-primary) 38%, transparent)";
const fieldBorderStyle: React.CSSProperties = { border: FIELD_BORDER };
const nativeFieldStyle: React.CSSProperties = {
  background: "var(--ui-bg-input)",
  border: FIELD_BORDER,
  borderRadius: "var(--radius-sm, 2px)",
  color: "var(--ui-text-primary)",
  font: "inherit",
  minHeight: "5.5em",
  outlineColor: "var(--ui-accent-secondary)",
  padding: "0.5em",
  resize: "vertical",
  width: "100%",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

