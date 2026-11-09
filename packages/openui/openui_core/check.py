"""A preliminary check of an OpenUI Lang program, so most mistakes reach the model before anyone sees them.

OpenUI Lang's parser is JavaScript. The browser's parsing, reference checks and form defaults stay authoritative.
"""
from __future__ import annotations

import difflib
import json
import re
from pathlib import Path

MAX_BYTES = int(2.5 * 1024 * 1024)
_CALL = re.compile(r"(?<![@\w.$])([A-Z][A-Za-z0-9]*)\s*\(")
_ROOT = re.compile(r"^\s*root\s*=", re.MULTILINE)
_REFUSED = re.compile(r"(?<![\w.])(?:Query\s*\(|Mutation\s*\(|@Run\b)")
_PAIRS = {")": "(", "]": "[", "}": "{"}
_LANGUAGE_CALLS = {"Action"}  # built into the language rather than the component library
_DASHBOARD_ROOT = re.compile(r"^\s*root\s*=\s*Dashboard\s*\(", re.MULTILINE)
_MUTATION = re.compile(r"(?<![\w.])Mutation\s*\(")
_QUERY = re.compile(r'(?<![\w.$@])Query\s*\(\s*("")?')
MAX_QUERIES = 6
_IMAGE_FIELD = re.compile(r"^(?!.*alt$).*(?:image|thumbnail|banner|picture)|^src$", re.IGNORECASE)  # the same test scripts/build.mjs uses


def _names(key: str = "components") -> set[str]:
    return set(json.loads((Path(__file__).parent / "catalog.json").read_text(encoding="utf-8"))[key])


def _code_only(program: str) -> str:
    """The program with string contents blanked and comments removed, as the parser reads it."""
    out, index, size = [], 0, len(program)
    while index < size:
        char = program[index]
        if char in "\"'":
            index += 1
            while index < size and program[index] != char:
                index += 2 if program[index] == "\\" else 1
            index += 1
            out.append('""')
        elif char == "#" or program.startswith("//", index):
            newline = program.find("\n", index)
            index = size if newline < 0 else newline
        else:
            out.append(char)
            index += 1
    return "".join(out)


def _tokens(program: str) -> list[tuple[str, str]]:
    """Names, string literals as the parser reads them, brackets, equals signs and line ends."""
    found, index, size = [], 0, len(program)
    while index < size:
        char = program[index]
        if char in "\"'":
            start = index + 1
            index = start
            while index < size and program[index] != char:
                index += 2 if program[index] == "\\" else 1
            raw = program[start:index]
            index += 1
            try:
                found.append(("string", json.loads('"' + raw.replace("\\'", "'").replace('"', '\\"').replace('\\\\"', '\\"') + '"')))
            except ValueError:
                found.append(("string", raw))
        elif char == "#" or program.startswith("//", index):
            newline = program.find("\n", index)
            index = size if newline < 0 else newline
        elif char.isalpha() or char in "_$":
            start = index
            while index < size and (program[index].isalnum() or program[index] in "_$"):
                index += 1
            found.append(("name", program[start:index]))
        else:
            if char in "()[]{}=,:\n":
                found.append((char, char))
            index += 1
    return found


def string_values(program: str) -> list[str]:
    """Every string literal in the program, as the parser reads it."""
    return [text for kind, text in _tokens(program) if kind == "string"]


class _Frame:
    """One open bracket: the component a call belongs to, which argument we're in, and an object's current key."""

    def __init__(self, component):
        self.component, self.argument, self.key = component, 0, None


def _opened_by_brace(tokens: list[tuple[str, str]], index: int) -> bool:
    """Is the bracket directly around this token a `{`? A `:` elsewhere is part of a ternary."""
    depth = 0
    for kind, _ in reversed(tokens[:index]):
        if kind in ")]}":
            depth += 1
        elif kind in "([{":
            if depth == 0:
                return kind == "{"
            depth -= 1
    return False


def _reaches_image_field(stack: list[_Frame], image_fields: dict) -> bool:
    """The innermost component decides. Inside it, any object keys on the way must be image fields too."""
    for position in range(len(stack) - 1, -1, -1):
        frame = stack[position]
        if frame.component:
            if frame.argument not in image_fields.get(frame.component, ()):
                return False
            return all(inner.key is None or _IMAGE_FIELD.search(inner.key) for inner in stack[position + 1:])
    return False


def image_values(program: str) -> list[str]:
    """Strings that can reach an image field of a component, directly or through a variable."""
    image_fields = json.loads((Path(__file__).parent / "catalog.json").read_text(encoding="utf-8"))["image_components"]
    statements: dict[str, tuple[list, list]] = {}
    tokens, found, wanted = _tokens(program), [], []
    current, stack, pending = None, [], None
    for index, (kind, text) in enumerate(tokens):
        following = tokens[index + 1][0] if index + 1 < len(tokens) else ""
        if kind == "\n":
            if not stack:
                current = None
        elif kind == "=":
            continue
        elif kind == "name" and current is None and not stack:
            if following == "=":
                current = statements.setdefault(text, ([], []))
        elif kind == "name" and following == "(":
            pending = text
        elif kind in "([{":
            stack.append(_Frame(pending if kind == "(" else None))
            pending = None
        elif kind in ")]}":
            if stack:
                stack.pop()
        elif kind == ",":
            if stack:
                stack[-1].argument += 1
        elif kind == ":":
            continue
        elif kind in ("name", "string") and following == ":" and stack and stack[-1].component is None and _opened_by_brace(tokens, index):
            stack[-1].key = text
        elif current is not None:
            is_string = kind == "string"
            # What a variable can pass on to an image field: not text inside a call, nor under another object key.
            if all(frame.component is None and (frame.key is None or _IMAGE_FIELD.search(frame.key)) for frame in stack):
                current[0 if is_string else 1].append(text)
            if _reaches_image_field(stack, image_fields):
                (found if is_string else wanted).append(text)
    seen = set()
    while wanted:
        name = wanted.pop()
        if name in statements and name not in seen:
            seen.add(name)
            found.extend(statements[name][0])
            wanted.extend(statements[name][1])
    return found


def _unbalanced(text: str) -> str | None:
    stack: list[str] = []
    for char in text:
        if char in "([{":
            stack.append(char)
        elif char in _PAIRS:
            if not stack or stack.pop() != _PAIRS[char]:
                return f"Unmatched '{char}'"
    return f"Unclosed '{stack[-1]}'" if stack else None


def is_dashboard(program: object) -> bool:
    return isinstance(program, str) and bool(_DASHBOARD_ROOT.search(_code_only(program)))


def _dashboard_problem(program: str, bare: str, sources) -> dict | None:
    if _MUTATION.search(bare):
        return {"ok": False, "error": "Dashboards only read: Mutation() isn't available"}
    if not sources:
        return {"ok": False, "error": "Live dashboards aren't set up on this Hermes",
                "fix": "Ask the user to add the MCP tools a dashboard may read under plugins.entries.hermes-openui: "
                       "the server in mcp_allowlist and server.tool in settings.dashboard_sources. Until then, draw an "
                       "ordinary view."}
    values = string_values(program)
    found = list(_QUERY.finditer(bare))
    if not found:
        return {"ok": False, "error": "A dashboard reads live data: add at least one Query() on a listed source"}
    if len(found) > MAX_QUERIES:
        return {"ok": False, "error": f"At most {MAX_QUERIES} queries per dashboard"}
    choices = ", ".join(sources)
    for match in found:
        if not match.group(1):
            return {"ok": False, "error": "Write each Query's source as a literal string",
                    "fix": f"Listed sources: {choices}"}
        source = values[bare.count('""', 0, match.end()) - 1]
        if source not in sources:
            return {"ok": False, "error": f"{source} isn't a listed dashboard source",
                    "fix": f"Listed sources: {choices}. Add others under plugins.entries.hermes-openui.settings.dashboard_sources."}
    return None


def check(program, sources=()) -> dict:
    if not isinstance(program, str) or not program.strip():
        return {"ok": False, "error": "program is empty"}
    if len(program.encode("utf-8")) > MAX_BYTES:
        return {"ok": False, "error": "program exceeds the 2.5 MB limit"}
    bare = _code_only(program)
    if "```" in bare:
        return {"ok": False, "error": "Pass the program itself, without a code fence"}
    if not _ROOT.search(bare):
        return {"ok": False, "error": "The program needs a `root = Stack([...])` statement"}
    dashboard = bool(_DASHBOARD_ROOT.search(bare))
    if not dashboard and _REFUSED.search(bare):
        return {"ok": False, "error": "Query(), Mutation() and @Run aren't available in chat views"}
    problem = _unbalanced(bare)
    if problem:
        return {"ok": False, "error": f"{problem} outside a string"}
    if dashboard:
        refusal = _dashboard_problem(program, bare, list(sources))
        if refusal:
            return refusal
    known = (_names("dashboard_components") | {"Query"} if dashboard else _names()) | _LANGUAGE_CALLS
    unknown = sorted({name for name in _CALL.findall(bare) if name not in known})
    if unknown:
        hints = {name: difflib.get_close_matches(name, known, n=1) for name in unknown}
        detail = ", ".join(f"{name} (did you mean {hint[0]}?)" if hint else name for name, hint in hints.items())
        return {"ok": False, "error": f"Unknown component: {detail}"}
    return {"ok": True}
