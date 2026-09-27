import { describe, expect, it } from "vitest";
import {
    buildCatalogue,
    deriveTitle,
    toRequestMessages,
    type ChatMessage,
} from "./chat";
import { CALCULATORS } from "./registry";
import { CATEGORIES } from "./categories";

function message(overrides: Partial<ChatMessage> = {}): ChatMessage {
    return {
        id: "m1",
        role: "user",
        content: "hello",
        at: 0,
        ...overrides,
    };
}

describe("buildCatalogue", () => {
    const catalogue = buildCatalogue();

    it("lists every calculator in the build under its category", () => {
        for (const calc of CALCULATORS) {
            expect(catalogue).toContain(calc.id);
        }
        for (const category of CATEGORIES) {
            expect(catalogue).toContain(`${category.name}:`);
        }
    });

    it("uses the `id | name — summary` shape the system prompt promises", () => {
        const first = CALCULATORS[0];
        expect(catalogue).toContain(`- ${first.id} | ${first.name} — `);
    });

    it("returns the same string on every call", () => {
        // Cached: rebuilding a 100+ line catalogue per render would be waste.
        expect(buildCatalogue()).toBe(catalogue);
    });

    it("stays small enough to send on every request", () => {
        // A rough ceiling: the whole catalogue should be a few KB, not tens.
        expect(catalogue.length).toBeLessThan(20_000);
    });

    it("collapses whitespace and truncates an over-long summary", () => {
        const summary = CALCULATORS.map((c) => c.summary).find(
            (s) => s.length > 110,
        );
        if (!summary) return; // Nothing to truncate in this build.
        expect(catalogue).not.toContain(summary.replace(/\s+/g, " ").trim());
    });
});

describe("deriveTitle", () => {
    it("collapses whitespace", () => {
        expect(deriveTitle("  how   much  cement ")).toBe("how much cement");
    });

    it("truncates a long question with an ellipsis", () => {
        const title = deriveTitle("a".repeat(60));
        expect(title).toHaveLength(44);
        expect(title.endsWith("…")).toBe(true);
    });

    it("falls back for empty input", () => {
        expect(deriveTitle("   ")).toBe("New chat");
    });

    it("leaves a short question untouched", () => {
        expect(deriveTitle("M25 mix ratio")).toBe("M25 mix ratio");
    });
});

describe("toRequestMessages", () => {
    it("drops the in-flight assistant placeholder", () => {
        const messages = [
            message({ id: "a", role: "user", content: "q" }),
            message({ id: "b", role: "assistant", content: "", pending: true }),
        ];
        expect(toRequestMessages(messages)).toEqual([
            { role: "user", content: "q" },
        ]);
    });

    it("keeps a stopped answer when it has partial text", () => {
        // Dropping it would leave two user turns adjacent and lose context the
        // model has already seen.
        const messages = [
            message({ id: "a", role: "user", content: "q" }),
            message({
                id: "b",
                role: "assistant",
                content: "half",
                stopped: true,
            }),
        ];
        expect(toRequestMessages(messages)).toEqual([
            { role: "user", content: "q" },
            { role: "assistant", content: "half" },
        ]);
    });

    it("drops empty turns", () => {
        const messages = [
            message({ id: "a", role: "assistant", content: "   " }),
            message({ id: "b", role: "user", content: "q" }),
        ];
        expect(toRequestMessages(messages)).toEqual([
            { role: "user", content: "q" },
        ]);
    });

    it("trims the text it sends", () => {
        expect(toRequestMessages([message({ content: "  q  " })])).toEqual([
            { role: "user", content: "q" },
        ]);
    });
});
