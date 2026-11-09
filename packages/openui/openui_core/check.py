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


def _names() -> set[str]:
    return set(json.loads((Path(__file__).parent / "catalog.json").read_text(encoding="utf-8"))["components"])


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


def _unbalanced(text: str) -> str | None:
    stack: list[str] = []
    for char in text:
        if char in "([{":
            stack.append(char)
        elif char in _PAIRS:
            if not stack or stack.pop() != _PAIRS[char]:
                return f"Unmatched '{char}'"
    return f"Unclosed '{stack[-1]}'" if stack else None


def check(program) -> dict:
    if not isinstance(program, str) or not program.strip():
        return {"ok": False, "error": "program is empty"}
    if len(program.encode("utf-8")) > MAX_BYTES:
        return {"ok": False, "error": "program exceeds the 2.5 MB limit"}
    bare = _code_only(program)
    if "```" in bare:
        return {"ok": False, "error": "Pass the program itself, without a code fence"}
    if not _ROOT.search(bare):
        return {"ok": False, "error": "The program needs a `root = Stack([...])` statement"}
    if _REFUSED.search(bare):
        return {"ok": False, "error": "Query(), Mutation() and @Run aren't available in chat views"}
    problem = _unbalanced(bare)
    if problem:
        return {"ok": False, "error": f"{problem} outside a string"}
    known = _names() | _LANGUAGE_CALLS
    unknown = sorted({name for name in _CALL.findall(bare) if name not in known})
    if unknown:
        hints = {name: difflib.get_close_matches(name, known, n=1) for name in unknown}
        detail = ", ".join(f"{name} (did you mean {hint[0]}?)" if hint else name for name, hint in hints.items())
        return {"ok": False, "error": f"Unknown component: {detail}"}
    return {"ok": True}
