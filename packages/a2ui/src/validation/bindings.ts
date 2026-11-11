const forbiddenSegments = new Set(["__proto__", "prototype", "constructor"]);

function pointerSegments(path: string): string[] {
  if (typeof path !== "string" || path.length > 256) {
    throw new TypeError("Binding path must be a string of at most 256 characters");
  }
  // Match GenUI's DataPath: both `/a/b` and `a/b` are accepted, and a
  // leading/trailing separator does not create an empty segment.
  if (path === "" || path === "/") return [];
  let normalized = path.startsWith("/") ? path.slice(1) : path;
  if (normalized.endsWith("/")) normalized = normalized.slice(0, -1);
  if (normalized.length === 0) return [];
  return normalized.split("/").map((part) => {
    const segment = part.replace(/~1/gu, "/").replace(/~0/gu, "~");
    if (forbiddenSegments.has(segment)) throw new TypeError("Binding path contains a forbidden key");
    return segment;
  });
}

/**
 * Resolves only a literal or the A2UI binding form: `{path}` in v0.9, `{"@path"}` in 1.0 (a plain `{path}` is ordinary data
 * there). It never evaluates functions or expressions. The renderer's own surfaces are already in the `{path}` shape.
 */
export function resolveBinding(value: unknown, dataModel: Record<string, unknown>, version: "v0.9" | "1.0" = "v0.9"): unknown {
  const key = version === "1.0" ? "@path" : "path";
  if (!isRecord(value) || Object.keys(value).length !== 1 || typeof value[key] !== "string") {
    return value;
  }
  let current: unknown = dataModel;
  for (const segment of pointerSegments(value[key] as string)) {
    if (Array.isArray(current)) {
      if (!/^(0|[1-9]\d*)$/u.test(segment)) return undefined;
      const index = Number(segment);
      if (index >= current.length) return undefined;
      current = current[index];
    } else if (isRecord(current) && Object.hasOwn(current, segment)) {
      current = current[segment];
    } else {
      return undefined;
    }
  }
  return current;
}

/** Returns an immutable data model with a JSON Pointer value set. Null removes the addressed value, matching GenUI v0.9. */
export function updateDataModel(
  model: Record<string, unknown>,
  path: string,
  value: unknown,
): Record<string, unknown> {
  const parts = pointerSegments(path);
  if (parts.length === 0) {
    if (value === null) return Object.create(null) as Record<string, unknown>;
    if (!isRecord(value)) throw new TypeError("The data model root must be an object");
    assertSafeTree(value);
    return cloneTree(value) as Record<string, unknown>;
  }
  const result = cloneTree(model) as Record<string, unknown>;
  let cursor: Record<string, unknown> | unknown[] = result;
  for (let i = 0; i < parts.length - 1; i += 1) {
    const part = parts[i]!;
    const next = parts[i + 1]!;
    const existing = getChild(cursor, part);
    if (existing === undefined || existing === null) {
      const created: Record<string, unknown> | unknown[] = isArrayIndex(next)
        ? []
        : Object.create(null) as Record<string, unknown>;
      setChild(cursor, part, created);
      cursor = created;
    } else if (isRecord(existing) || Array.isArray(existing)) {
      cursor = existing;
    } else {
      throw new TypeError("Binding path crosses a scalar value");
    }
  }
  const leaf = parts[parts.length - 1]!;
  if (Array.isArray(cursor)) {
    const index = arrayIndex(leaf);
    if (index > 1000) throw new TypeError("Binding path array index exceeds the safe limit");
    while (cursor.length <= index) cursor.push(null);
    if (value === null) cursor.splice(index, 1);
    else cursor[index] = cloneTreeChecked(value);
  } else if (value === null) {
    delete cursor[leaf];
  } else {
    cursor[leaf] = cloneTreeChecked(value);
  }
  return result;
}

function getChild(parent: Record<string, unknown> | unknown[], segment: string): unknown {
  if (Array.isArray(parent)) {
    if (!isArrayIndex(segment)) throw new TypeError("Array binding path segment must be an index");
    return parent[Number(segment)];
  }
  return parent[segment];
}

function setChild(parent: Record<string, unknown> | unknown[], segment: string, value: unknown): void {
  if (Array.isArray(parent)) {
    const index = arrayIndex(segment);
    if (index > 1000) throw new TypeError("Binding path array index exceeds the safe limit");
    while (parent.length <= index) parent.push(null);
    parent[index] = value;
  } else {
    parent[segment] = value;
  }
}

function arrayIndex(segment: string): number {
  if (!isArrayIndex(segment)) throw new TypeError("Array binding path segment must be an index");
  return Number(segment);
}

function isArrayIndex(value: string): boolean {
  return /^(0|[1-9]\d*)$/u.test(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function assertSafeTree(value: unknown): void {
  const stack: Array<{ value: unknown; depth: number }> = [{ value, depth: 0 }];
  while (stack.length > 0) {
    const item = stack.pop()!;
    if (item.depth > 32) throw new TypeError("Data model nesting exceeds the safe limit");
    if (Array.isArray(item.value)) {
      for (const child of item.value) stack.push({ value: child, depth: item.depth + 1 });
    } else if (isRecord(item.value)) {
      for (const [key, child] of Object.entries(item.value)) {
        if (forbiddenSegments.has(key)) throw new TypeError("Data model contains a forbidden key");
        stack.push({ value: child, depth: item.depth + 1 });
      }
    }
  }
}

function cloneTree(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(cloneTree);
  if (isRecord(value)) {
    const copy = Object.create(null) as Record<string, unknown>;
    for (const [key, child] of Object.entries(value)) copy[key] = cloneTree(child);
    return copy;
  }
  return value;
}

function cloneTreeChecked(value: unknown): unknown {
  assertSafeTree(value);
  return cloneTree(value);
}
