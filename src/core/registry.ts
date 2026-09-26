import type { Calculator, CategoryId } from "./types";
import { ALL_CALCULATORS } from "@/calculators";

/** Every calculator, sorted by category order then name. */
export const CALCULATORS: Calculator[] = ALL_CALCULATORS;

export const CALCULATOR_BY_ID: Record<string, Calculator> = Object.fromEntries(
    CALCULATORS.map((c) => [c.id, c]),
);

export function getCalculator(id: string | undefined): Calculator | undefined {
    return id ? CALCULATOR_BY_ID[id] : undefined;
}

export function byCategory(category: CategoryId): Calculator[] {
    return CALCULATORS.filter((c) => c.category === category);
}

export function countByCategory(): Record<string, number> {
    const counts: Record<string, number> = {};
    for (const c of CALCULATORS)
        counts[c.category] = (counts[c.category] ?? 0) + 1;
    return counts;
}

const norm = (s: string) => s.toLowerCase().trim();

/** Ranked search across name, summary, tags and category. */
export function searchCalculators(query: string, limit = 40): Calculator[] {
    const q = norm(query);
    if (!q) return [];

    const terms = q.split(/\s+/).filter(Boolean);

    const scored = CALCULATORS.map((c) => {
        const name = norm(c.name);
        const summary = norm(c.summary);
        const tags = (c.tags ?? []).map(norm).join(" ");
        const cat = norm(c.category);
        const haystack = `${name} ${summary} ${tags} ${cat}`;

        if (!terms.every((t) => haystack.includes(t))) return null;

        let score = 0;
        if (name === q) score += 100;
        if (name.startsWith(q)) score += 50;
        if (name.includes(q)) score += 30;
        if (tags.includes(q)) score += 15;
        if (summary.includes(q)) score += 5;
        for (const t of terms) {
            if (name.includes(t)) score += 8;
            if (tags.includes(t)) score += 3;
        }
        return { c, score };
    }).filter((x): x is { c: Calculator; score: number } => x !== null);

    scored.sort(
        (a, b) => b.score - a.score || a.c.name.localeCompare(b.c.name),
    );
    return scored.slice(0, limit).map((s) => s.c);
}
