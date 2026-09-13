/**
 * Structured renderer for arbitrary JSON-ish payloads (event state, tool invocations,
 * audit input/output). Replaces raw JSON.stringify(...) blobs in the UI with a real
 * key/value tree: primitives render as label/value rows, arrays as chip lists or nested
 * rows, and nested objects recurse with indentation. No dependency on payload shape.
 */

type Json = null | boolean | number | string | Json[] | { [key: string]: Json };

function humanizeKey(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (c) => c.toUpperCase());
}

function ValueChip({ value }: { value: string }) {
  return (
    <span className="inline-flex items-center rounded-md border border-border bg-muted px-2 py-0.5 text-xs font-mono text-foreground/80">
      {value}
    </span>
  );
}

function PrimitiveValue({ value }: { value: null | boolean | number | string }) {
  if (value === null) {
    return <span className="text-xs italic text-muted-foreground">null</span>;
  }
  if (typeof value === "boolean") {
    return (
      <span
        className={`text-xs font-medium ${value ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500"}`}
      >
        {value ? "true" : "false"}
      </span>
    );
  }
  return <span className="text-sm font-mono break-all">{String(value)}</span>;
}

export function StructuredNode({ data, depth = 0 }: { data: Json; depth?: number }) {
  if (data === null || typeof data !== "object") {
    return <PrimitiveValue value={data} />;
  }

  if (Array.isArray(data)) {
    if (data.length === 0) {
      return <span className="text-xs italic text-muted-foreground">empty list</span>;
    }
    const allPrimitive = data.every((item) => item === null || typeof item !== "object");
    if (allPrimitive) {
      return (
        <div className="flex flex-wrap gap-1.5">
          {data.map((item, idx) => (
            <ValueChip key={idx} value={String(item)} />
          ))}
        </div>
      );
    }
    return (
      <ul className="space-y-1.5">
        {data.map((item, idx) => (
          <li key={idx} className="rounded-md border border-border/60 bg-background/50 p-2">
            <StructuredNode data={item} depth={depth + 1} />
          </li>
        ))}
      </ul>
    );
  }

  const entries = Object.entries(data);
  if (entries.length === 0) {
    return <span className="text-xs italic text-muted-foreground">empty</span>;
  }

  return (
    <dl className={depth === 0 ? "space-y-1.5" : "space-y-1.5 border-l border-border/60 pl-3"}>
      {entries.map(([key, value]) => {
        const isNested = value !== null && typeof value === "object";
        return (
          <div key={key} className={isNested ? "space-y-1" : "flex items-start justify-between gap-3"}>
            <dt className="shrink-0 text-xs font-medium text-muted-foreground">{humanizeKey(key)}</dt>
            <dd className={isNested ? "" : "text-right"}>
              <StructuredNode data={value} depth={depth + 1} />
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

/** Labeled panel wrapper for a StructuredNode — the standard way to present a JSON field. */
export function StructuredPanel({
  label,
  data,
  className = "",
}: {
  label: string;
  data: unknown;
  className?: string;
}) {
  const safeData = (data ?? null) as Json;
  return (
    <div className={`rounded-lg border border-border bg-muted/40 p-3 ${className}`}>
      <span className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <StructuredNode data={safeData} />
    </div>
  );
}
