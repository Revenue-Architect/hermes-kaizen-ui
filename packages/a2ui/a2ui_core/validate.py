"""Python port of src/validation/index.ts, so the model hears about a bad surface before anyone sees it.

tests/test_parity.py runs a shared corpus through this and the browser validator and requires the same verdict.
"""
from __future__ import annotations

import base64
import json
import math
import re
from datetime import datetime, timedelta
from pathlib import Path

MAX_PAYLOAD_BYTES = 256 * 1024
MAX_COMPONENTS = 100
MAX_DEPTH = 12
CATALOG_ID = "https://a2ui.org/specification/v0_9/catalogs/basic/catalog.json"
CONTRACTS = Path(__file__).resolve().parents[1] / "src" / "contracts" / "v0_9"
FORBIDDEN_KEYS = {"__proto__", "prototype", "constructor"}
EVENT_NAME = re.compile(r"^[A-Za-z][A-Za-z0-9_-]*(?:\.[A-Za-z][A-Za-z0-9_-]*)*$")
ARRAY_INDEX = re.compile(r"^(0|[1-9][0-9]*)$")
STACK_IN_ROW = {
    "MiniChart", "StatusBadge", "Slider", "TextField", "ChoicePicker", "DateTimeInput",
    "Card", "Column", "Row", "List", "Tabs", "InfoRow", "StepRail", "ActionCallout",
    "ArtifactTile", "BotBadge", "ExpandableSection", "ProgressMeter", "ActivityFeed",
    "ScheduleTile", "MessagePreview", "CommandBlock", "TaskTile", "KeyValueGrid",
    "ComparisonCard", "CitationCard", "SourceExcerpt", "DataTable", "DraftReview",
    "ChangeDiff", "MultiSeriesChart", "Agenda", "CalendarGrid", "DecisionTree",
    "ScenarioSlider", "RelationshipMap", "RoomMap", "BeforeAfterViewer", "JourneyMap",
    "EvidenceTrail",
}
ALWAYS_STACK = {
    "ProgressMeter", "ActivityFeed", "ScheduleTile", "MessagePreview", "CommandBlock",
    "TaskTile", "KeyValueGrid", "ComparisonCard", "CitationCard", "SourceExcerpt",
    "DataTable", "DraftReview", "ChangeDiff", "MultiSeriesChart", "Agenda", "CalendarGrid",
    "DecisionTree", "ScenarioSlider", "RelationshipMap", "RoomMap", "BeforeAfterViewer",
    "JourneyMap", "EvidenceTrail",
}


_JS_SPACE = "\t\n\x0b\x0c\r \xa0\u1680\u2000\u2001\u2002\u2003\u2004\u2005\u2006\u2007\u2008\u2009\u200a\u2028\u2029\u202f\u205f\u3000\ufeff"
_TIMESTAMP = re.compile(r"([0-9]{4}-[0-9]{2}-[0-9]{2})(?:[T ]([0-9]{2}):([0-9]{2})(?::([0-9]{2})(?:\.[0-9]{1,9})?)?(?:Z|[+-][0-9]{2}:?[0-9]{2})?)?")


def _js_strip(value: str) -> str:
    return value.strip(_JS_SPACE)


def _js_len(value: str) -> int:
    """String.length: handwritten limits count UTF-16 units, as the browser validator does."""
    return len(value.encode("utf-16-le", "surrogatepass")) // 2


class Invalid(Exception):
    pass


class Unsafe(Exception):
    """The browser validator throws here; both end as the same generic refusal."""


def _read(name: str) -> dict:
    return json.loads((CONTRACTS / name).read_text(encoding="utf-8"))


class _Schemas:
    def __init__(self):
        from jsonschema import Draft202012Validator
        from referencing import Registry, Resource
        from referencing.jsonschema import DRAFT202012

        basic, common = _read("catalog-v0_9-basic.json"), _read("common-types-v0_9.json")
        self.extensions, self.legacy = _read("extension-schemas.json"), _read("legacy-custom-component-schemas.json")
        enabled = _read("registry-manifest.json")["basicEnabled"]
        self.custom_names = {*self.legacy, *self.extensions}
        self.names = {*enabled, *self.custom_names}

        def resource(schema):
            return Resource.from_contents(schema, default_specification=DRAFT202012)

        registry = Registry().with_resources([
            (common["$id"], resource(common)),
            (basic["$id"], resource(basic)),
            ("https://a2ui.org/specification/v0_9/catalog.json", resource(basic)),
        ])
        self.validators = {}
        for name in self.names:
            if name in basic["components"]:
                schema = {"$ref": f"{basic['$id']}#/components/{name}"}
            else:
                schema = self._custom(name, self.legacy.get(name) or self.extensions[name])
            self.validators[name] = Draft202012Validator(schema, registry=registry)

    @staticmethod
    def _custom(name: str, source: dict) -> dict:
        return {
            "type": "object",
            "properties": {
                "id": {"type": "string", "minLength": 1, "maxLength": 128},
                "component": {"const": name},
                "accessibility": {"$ref": "https://a2ui.org/specification/v0_9/common_types.json#/$defs/AccessibilityAttributes"},
                "weight": {"type": "number"},
                **source.get("properties", {}),
            },
            "required": ["id", "component", *source.get("required", [])],
            "additionalProperties": False,
        }

    def check(self, component: dict) -> None:
        name = component["component"]
        if any(isinstance(item, float) and not math.isfinite(item) for item in _walk(component)):
            raise Invalid(f"Invalid {name} component: a number is out of range")
        error = next(iter(self.validators[name].iter_errors(component)), None)
        if error is not None:
            where = "/".join(str(part) for part in error.absolute_path) or "component"
            raise Invalid(f"Invalid {name} component: {where}: {error.message}"[:180].replace("\n", " "))


_schemas: _Schemas | None = None


def _get_schemas() -> _Schemas:
    global _schemas
    if _schemas is None:
        _schemas = _Schemas()
    return _schemas


def _is_number(value) -> bool:
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def _to_number(value) -> float:
    """JavaScript's Number() for the values these schemas can hold."""
    if isinstance(value, bool):
        return float(value)
    if isinstance(value, (int, float)):
        return float(value)
    if isinstance(value, str):
        try:
            return float(value) if _js_strip(value) else 0.0
        except ValueError:
            return math.nan
    return math.nan


def _valid_id(value) -> bool:
    return isinstance(value, str) and 0 < _js_len(value) <= 128


def _only_keys(value: dict, allowed) -> bool:
    return set(value) <= set(allowed)


def _bad_segment(path: str) -> bool:
    return any(part.replace("~1", "/").replace("~0", "~") in FORBIDDEN_KEYS for part in path.split("/"))


def _walk(value):
    stack = [value]
    while stack:
        item = stack.pop()
        yield item
        if isinstance(item, list):
            stack.extend(item)
        elif isinstance(item, dict):
            stack.extend(item.values())


def _check_safe_tree(value) -> None:
    stack = [(value, 0)]
    while stack:
        item, depth = stack.pop()
        if depth > 32:
            raise Invalid("JSON nesting exceeds the safe limit")
        if isinstance(item, list):
            stack.extend((child, depth + 1) for child in item)
        elif isinstance(item, dict):
            for key, child in item.items():
                if key in FORBIDDEN_KEYS:
                    raise Invalid("JSON contains a forbidden prototype key")
                if "call" in item or "functionCall" in item:
                    raise Invalid("Client functions are not supported")
                stack.append((child, depth + 1))


# ---- data model ----

def _segments(path: str) -> list:
    if not isinstance(path, str) or _js_len(path) > 256:
        raise Unsafe
    if path in ("", "/"):
        return []
    normal = path[1:] if path.startswith("/") else path
    if normal.endswith("/"):
        normal = normal[:-1]
    if not normal:
        return []
    parts = [part.replace("~1", "/").replace("~0", "~") for part in normal.split("/")]
    if any(part in FORBIDDEN_KEYS for part in parts):
        raise Unsafe
    return parts


def _checked_copy(value):
    stack = [(value, 0)]
    while stack:
        item, depth = stack.pop()
        if depth > 32:
            raise Unsafe
        if isinstance(item, list):
            stack.extend((child, depth + 1) for child in item)
        elif isinstance(item, dict):
            for key, child in item.items():
                if key in FORBIDDEN_KEYS:
                    raise Unsafe
                stack.append((child, depth + 1))
    return json.loads(json.dumps(value))


def _index(segment: str) -> int:
    if not ARRAY_INDEX.fullmatch(segment):
        raise Unsafe
    index = int(segment)
    if index > 1000:
        raise Unsafe
    return index


def _update_model(model: dict, path: str, value) -> dict:
    parts = _segments(path)
    if not parts:
        if value is None:
            return {}
        if not isinstance(value, dict):
            raise Unsafe
        return _checked_copy(value)
    result = json.loads(json.dumps(model))
    cursor = result
    for position, part in enumerate(parts[:-1]):
        following = parts[position + 1]
        if isinstance(cursor, list):
            if not ARRAY_INDEX.fullmatch(part):
                raise Unsafe
            existing = cursor[int(part)] if int(part) < len(cursor) else None
        else:
            existing = cursor.get(part)
        if existing is None:
            created = [] if ARRAY_INDEX.fullmatch(following) else {}
            if isinstance(cursor, list):
                index = _index(part)
                while len(cursor) <= index:
                    cursor.append(None)
                cursor[index] = created
            else:
                cursor[part] = created
            cursor = created
        elif isinstance(existing, (dict, list)):
            cursor = existing
        else:
            raise Unsafe
    leaf = parts[-1]
    if isinstance(cursor, list):
        index = _index(leaf)
        while len(cursor) <= index:
            cursor.append(None)
        if value is None:
            del cursor[index]
        else:
            cursor[index] = _checked_copy(value)
    elif value is None:
        cursor.pop(leaf, None)
    else:
        cursor[leaf] = _checked_copy(value)
    return result


# ---- component checks ----

def _valid_bindings(component) -> bool:
    for item in _walk(component):
        if isinstance(item, dict) and "path" in item:
            template = "componentId" in item and _only_keys(item, ["componentId", "path"]) and isinstance(item["componentId"], str)
            path = item["path"]
            if not isinstance(path, str) or (not template and len(item) != 1) or _js_len(path) > 256 or _bad_segment(path):
                return False
    return True


def _safe_context(value, depth: int) -> bool:
    if depth > 3:
        return False
    if isinstance(value, bool):
        return True
    if isinstance(value, (int, float)):
        return math.isfinite(value)
    if isinstance(value, str):
        return _js_len(value) <= 2048
    if isinstance(value, list):
        return len(value) <= 32 and all(_safe_context(child, depth + 1) for child in value)
    if isinstance(value, dict):
        return _only_keys(value, ["path"]) and isinstance(value.get("path"), str) and _js_len(value["path"]) <= 256 and not _bad_segment(value["path"])
    return False


def _valid_event_action(action) -> bool:
    if not isinstance(action, dict) or not _only_keys(action, ["event"]) or not isinstance(action.get("event"), dict):
        return False
    event = action["event"]
    name = event.get("name")
    if not _only_keys(event, ["name", "context"]) or not isinstance(name, str) or _js_len(name) > 80 or not EVENT_NAME.fullmatch(name):
        return False
    if "context" not in event:
        return True
    context = event["context"]
    if not isinstance(context, dict) or len(context) > 16:
        return False
    return all(0 < _js_len(key) <= 80 and _safe_context(item, 0) for key, item in context.items())


def _valid_event_actions(component) -> bool:
    for item in _walk(component):
        if isinstance(item, dict):
            if "call" in item or "functionCall" in item:
                return False
            if "event" in item and not _valid_event_action(item):
                return False
    return True


def _valid_timestamp(value) -> bool:
    if not isinstance(value, str) or _js_len(value) > 40:
        return False
    found = _TIMESTAMP.fullmatch(value)
    if not found or _date_only(found.group(1)) is None:
        return False
    hour, minute, second = (int(found.group(index) or 0) for index in (2, 3, 4))
    return hour <= 23 and minute <= 59 and second <= 59


def _date_only(value: str):
    if not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
        return None
    try:
        return datetime.strptime(value, "%Y-%m-%d")
    except ValueError:
        return None


def _decision_tree_ok(value: dict) -> bool:
    if not isinstance(value.get("nodes"), list):
        return False
    nodes = [node for node in value["nodes"] if isinstance(node, dict)]
    ids = [node.get("id") for node in nodes]
    start = value.get("start")
    if len({json.dumps(item) for item in ids}) != len(nodes) or not isinstance(start, str) or start not in ids:
        return False
    by_id = {str(node.get("id")): node for node in nodes}
    visiting, visited = set(), set()

    def walk(node_id: str, depth: int) -> bool:
        if depth > MAX_DEPTH or node_id in visiting or node_id not in by_id:
            return False
        if node_id in visited:
            return True
        visiting.add(node_id)
        for option in by_id[node_id]["options"]:
            if not isinstance(option, dict) or not walk(str(option.get("target")), depth + 1):
                return False
        visiting.discard(node_id)
        visited.add(node_id)
        return True

    return walk(start, 0) and len(visited) == len(nodes)


def _valid_semantics(component: dict) -> bool:
    kind = component["component"]
    value = component
    if kind == "MetricTile":
        if ("min" in value) != ("max" in value):
            return False
        if "min" in value and not _to_number(value["max"]) > _to_number(value["min"]):
            return False
        return "asOf" not in value or _valid_timestamp(value["asOf"])
    if kind == "MiniChart":
        points = value.get("points")
        return isinstance(points, list) and all(isinstance(point, dict) and _is_number(point.get("value")) for point in points) \
            and ("asOf" not in value or _valid_timestamp(value["asOf"]))
    if kind == "ProgressMeter":
        return _is_number(value.get("current")) and value["current"] >= 0 and _is_number(value.get("total")) and value["total"] > 0
    if kind == "CommandBlock":
        return isinstance(value.get("content"), str) and bool(_js_strip(value["content"]))
    if kind == "DataTable":
        columns, rows = value.get("columns"), value.get("rows")
        return isinstance(columns, list) and isinstance(rows, list) and all(isinstance(row, list) and len(row) == len(columns) for row in rows)
    if kind == "MultiSeriesChart":
        labels, series = value.get("labels"), value.get("series")
        return isinstance(labels, list) and isinstance(series, list) and all(
            isinstance(item, dict) and isinstance(item.get("values"), list) and len(item["values"]) == len(labels)
            and all(_is_number(sample) for sample in item["values"]) for item in series)
    if kind in ("Agenda", "CalendarGrid"):
        events = value.get("events")
        if not isinstance(events, list):
            return False
        dates = sorted({event.get("date") for event in events if isinstance(event, dict) and isinstance(event.get("date"), str)})
        parsed = [_date_only(date) for date in dates]
        if not dates or any(item is None for item in parsed):
            return False
        return kind == "Agenda" or parsed[-1] - parsed[0] <= timedelta(days=6)
    if kind == "DecisionTree":
        return _decision_tree_ok(value)
    if kind == "ScenarioSlider":
        numbers = [value.get(key) for key in ("min", "max", "value", "multiplier", "offset")]
        if not all(_is_number(item) for item in numbers):
            return False
        low, high, current, multiplier, offset = numbers
        return low < high and low <= current <= high and math.isfinite(low * multiplier + offset) and math.isfinite(high * multiplier + offset)
    if kind == "RelationshipMap":
        if not isinstance(value.get("nodes"), list) or not isinstance(value.get("edges"), list):
            return False
        nodes = [node for node in value["nodes"] if isinstance(node, dict)]
        ids = {json.dumps(node.get("id")) for node in nodes}
        return len(ids) == len(nodes) and all(
            isinstance(edge, dict) and json.dumps(edge.get("source")) in ids and json.dumps(edge.get("target")) in ids for edge in value["edges"])
    if kind == "RoomMap":
        if not isinstance(value.get("rooms"), list):
            return False
        rooms = [room for room in value["rooms"] if isinstance(room, dict)]
        ids = {json.dumps(room.get("id")) for room in rooms}
        return len(ids) == len(rooms) and all(
            all(_is_number(room.get(key)) for key in ("x", "y", "width", "height"))
            and room["x"] + room["width"] <= 1.000001 and room["y"] + room["height"] <= 1.000001 for room in rooms)
    if kind == "BeforeAfterViewer":
        return ("beforeMedia" in value) == ("afterMedia" in value)
    return True


def _check_component_safety(component: dict, schemas: _Schemas) -> None:
    name = component["component"]
    if not _valid_bindings(component):
        raise Invalid("A component contains an invalid data binding")
    if not _valid_event_actions(component):
        raise Invalid("A component contains an invalid event action")
    if name == "Button" and not _valid_event_action(component.get("action")):
        raise Invalid("Button actions must be fixed Hermes events")
    if not _valid_semantics(component):
        raise Invalid(f"{name} values are not semantically valid")
    if name in schemas.custom_names and any(isinstance(item, str) and not _js_strip(item) for item in _walk(component)):
        raise Invalid(f"{name} contains blank text")


def _references(component: dict) -> list:
    keys = ["child", "actionChild", "trigger"] if component["component"] == "CommandBlock" else ["child", "actionChild", "content", "trigger"]
    refs = []
    for key in keys:
        value = component.get(key)
        if value is not None:
            if not isinstance(value, str):
                raise Unsafe
            refs.append(value)
    children = component.get("children")
    if isinstance(children, list):
        for child in children:
            if not isinstance(child, str):
                raise Unsafe
            refs.append(child)
    elif isinstance(children, dict):
        if component["component"] == "Row" or not isinstance(children.get("componentId"), str) or not isinstance(children.get("path"), str):
            raise Unsafe
        refs.append(children["componentId"])
    elif children is not None:
        raise Unsafe
    if isinstance(component.get("tabs"), list):
        for tab in component["tabs"]:
            if not isinstance(tab, dict) or not isinstance(tab.get("content"), str):
                raise Unsafe
            refs.append(tab["content"])
    return refs


def _check_graph(components: dict) -> None:
    parents: dict[str, int] = {}
    child_refs = {}
    for component_id, component in components.items():
        refs = _references(component)
        child_refs[component_id] = refs
        for ref in refs:
            if ref not in components:
                raise Invalid(f'Component reference "{ref}" is missing')
            parents[ref] = parents.get(ref, 0) + 1
            if parents[ref] > 1:
                raise Invalid(f'Component "{ref}" has more than one parent')
    if parents.get("root", 0) != 0:
        raise Invalid("Root component cannot have a parent")
    active, visited = set(), set()

    def walk(node: str, depth: int) -> bool:
        if depth > MAX_DEPTH or node in active:
            return False
        if node in visited:
            return True
        active.add(node)
        for child in child_refs.get(node, []):
            if not walk(child, depth + 1):
                return False
        active.discard(node)
        visited.add(node)
        return True

    if not walk("root", 1):
        raise Invalid("Component graph contains a cycle or exceeds depth 12")
    if len(visited) != len(components):
        raise Invalid("Every component must be reachable from root")


def _normalize_tabs(component: dict) -> None:
    if component["component"] != "Tabs" or not isinstance(component.get("tabs"), list):
        return
    tabs = []
    for item in component["tabs"]:
        if isinstance(item, dict) and ("title" in item or "child" in item):
            if "label" in item or "content" in item or not isinstance(item.get("title"), str) or not isinstance(item.get("child"), str):
                raise Unsafe
            item = {**item, "label": item["title"], "content": item["child"]}
            item.pop("title")
            item.pop("child")
        tabs.append(item)
    component["tabs"] = tabs


def _positive_weight(component: dict) -> bool:
    weight = component.get("weight")
    return _is_number(weight) and float(weight).is_integer() and weight > 0


def _normalize_rows(components: dict, warnings: list) -> None:
    for component in components.values():
        if component["component"] != "Row":
            continue
        children = component.get("children")
        if isinstance(children, dict):
            raise Unsafe
        if not isinstance(children, list) or any(not isinstance(child, str) for child in children):
            continue
        row = [components[child] for child in children if child in components]
        kinds = {child["component"] for child in row}
        if (row and all(child["component"] == "MetricTile" for child in row)) or (len(row) > 1 and all(child["component"] == "Button" for child in row)):
            for child in row:
                child.setdefault("weight", 1)
            continue
        unweighted = [child for child in row if not _positive_weight(child)]
        must_stack = (
            any(child["component"] in ALWAYS_STACK for child in row)
            or ("Button" in kinds and any(child["component"] == "Text" for child in unweighted))
            or any(child["component"] in STACK_IN_ROW for child in unweighted)
            or any(child["component"] == "Text" and (not isinstance(child.get("text"), str) or _js_len(_js_strip(child["text"])) > 36) for child in unweighted)
            or ("MetricTile" in kinds and any(child["component"] == "MetricTile" for child in unweighted))
        )
        if must_stack:
            component["component"] = "Column"
            warnings.append("Mobile-compatible layout repair changed an overflowing Row to Column")


def _reject_constant(name):
    raise ValueError(name)


def _validate(payload: str) -> dict:
    schemas = _get_schemas()
    if len(payload.encode("utf-8")) > MAX_PAYLOAD_BYTES:
        raise Invalid("Payload exceeds the 256 KiB limit")
    states: dict[str, dict] = {}
    created, updated, referenced = set(), set(), set()
    updates = []

    def state_for(surface_id: str) -> dict:
        return states.setdefault(surface_id, {"components": {}, "model": {}, "updated": False, "deleted": False})

    for raw in re.split(r"\r?\n", payload):
        if not _js_strip(raw):
            continue
        try:
            decoded = json.loads(raw, parse_constant=_reject_constant, parse_int=float)
        except ValueError:
            raise Invalid("Payload contains malformed JSON") from None
        if not isinstance(decoded, dict):
            raise Invalid("Each JSONL entry must be an object")
        _check_safe_tree(decoded)
        if decoded.get("version") != "v0.9":
            raise Invalid("Only A2UI v0.9 messages are supported")
        ops = [key for key in ("createSurface", "updateComponents", "updateDataModel", "deleteSurface") if key in decoded]
        if len(ops) != 1 or any(key not in ("version", ops[0]) for key in decoded):
            raise Invalid("Each message must contain exactly one known v0.9 operation")
        op = ops[0]
        body = decoded[op]

        if op == "createSurface":
            if not isinstance(body, dict) or not _only_keys(body, ["surfaceId", "catalogId", "sendDataModel"]):
                raise Invalid("createSurface contains unsupported fields")
            surface = body.get("surfaceId")
            if not _valid_id(surface) or body.get("catalogId") != CATALOG_ID or surface in created \
                    or ("sendDataModel" in body and not isinstance(body["sendDataModel"], bool)):
                raise Invalid("createSurface has an unsupported catalog or invalid surface ID")
            created.add(surface)
            state_for(surface)["deleted"] = False
        elif op == "updateComponents":
            if not isinstance(body, dict) or not _only_keys(body, ["surfaceId", "components"]):
                raise Invalid("updateComponents contains unsupported fields")
            surface, rows = body.get("surfaceId"), body.get("components")
            if not _valid_id(surface) or not isinstance(rows, list) or not 1 <= len(rows) <= MAX_COMPONENTS:
                raise Invalid("updateComponents has an invalid surface or component count")
            state = state_for(surface)
            seen = set()
            for row in rows:
                if not isinstance(row, dict):
                    raise Invalid("Component entries must be objects")
                component = json.loads(json.dumps(row))
                if not _valid_id(component.get("id")) or not isinstance(component.get("component"), str) or component["component"] not in schemas.names:
                    raise Invalid("A component has an unknown type or invalid ID")
                if component["id"] in seen:
                    raise Invalid("A component ID is repeated in one update")
                seen.add(component["id"])
                _normalize_tabs(component)
                schemas.check(component)
                _check_component_safety(component, schemas)
                state["components"][component["id"]] = component
            if len(state["components"]) > MAX_COMPONENTS:
                raise Invalid("Surface exceeds the 100 component limit")
            state["updated"] = True
            state["deleted"] = False
            updated.add(surface)
            updates.append(surface)
        elif op == "updateDataModel":
            if not isinstance(body, dict) or not _only_keys(body, ["surfaceId", "path", "value"]) or not _valid_id(body.get("surfaceId")) \
                    or ("path" in body and (not isinstance(body["path"], str) or _js_len(body["path"]) > 256)):
                raise Invalid("updateDataModel has invalid fields")
            surface = body["surfaceId"]
            referenced.add(surface)
            state = state_for(surface)
            try:
                state["model"] = _update_model(state["model"], body.get("path", "/"), body.get("value"))
            except (Unsafe, IndexError):
                raise Invalid("updateDataModel contains an unsafe or invalid path/value") from None
            state["deleted"] = False
        else:
            if not isinstance(body, dict) or not _only_keys(body, ["surfaceId"]) or not _valid_id(body.get("surfaceId")):
                raise Invalid("deleteSurface has an invalid surface ID")
            referenced.add(body["surfaceId"])
            state_for(body["surfaceId"])["deleted"] = True

    if not created or not updated or created != updated or any(item not in created for item in referenced):
        raise Invalid("Every rendered surface must be created, updated, and scoped to this payload")

    warnings: list[str] = []
    for surface in updates:
        if not states[surface]["deleted"]:
            _normalize_rows(states[surface]["components"], warnings)
    surfaces = []
    for surface, state in states.items():
        if state["deleted"]:
            continue
        if not state["updated"] or "root" not in state["components"]:
            raise Invalid("Each rendered surface requires a root component")
        for component in state["components"].values():
            schemas.check(component)
            _check_component_safety(component, schemas)
        _check_graph(state["components"])
        surfaces.append(surface)
    return {"ok": True, "surfaces": surfaces, "warnings": sorted(set(warnings))}


def validate(payload) -> dict:
    """{"ok": True, "surfaces": [...], "warnings": [...]} or {"ok": False, "error": "..."}."""
    if not isinstance(payload, str):
        return {"ok": False, "error": "Payload must be text"}
    try:
        return _validate(payload)
    except Invalid as problem:
        return {"ok": False, "error": str(problem)[:180]}
    except (Unsafe, KeyError, TypeError, ValueError, IndexError, AttributeError, RecursionError, OverflowError):
        return {"ok": False, "error": "Payload could not be validated safely"}
