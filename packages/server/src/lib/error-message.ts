function readNestedMessage(value: unknown, seen: Set<object>): string | null {
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return null;

        try {
            const parsed = JSON.parse(trimmed);
            return readNestedMessage(parsed, seen) ?? trimmed;
        } catch {
            return trimmed;
        }
    }

    if (!value || typeof value !== "object" || seen.has(value)) return null;
    seen.add(value);

    const record = value as Record<string, unknown>;
    for (const key of ["message", "error", "responseBody", "data", "cause"]) {
        const message = readNestedMessage(record[key], seen);
        if (message && message !== "[object Object]") return message;
    }

    return null;
}

export function getErrorMessage(error: unknown): string {
    return readNestedMessage(error, new Set()) ?? "Unknown AI provider error";
}
