import { describe, expect, it } from "vitest";
import { normaliseMath, parseInline, parseMarkdown } from "./markdown";

/** Flattens inline nodes back to text, for readable assertions. */
function text(nodes: ReturnType<typeof parseInline>): string {
    return nodes
        .map((node) =>
            node.kind === "text" || node.kind === "code"
                ? node.text
                : node.kind === "link"
                  ? `[${text(node.content)}](${node.href})`
                  : text(node.content),
        )
        .join("");
}

describe("normaliseMath", () => {
    it("folds LaTeX fractions and roots into plain text", () => {
        expect(normaliseMath("\\frac{W}{L}")).toBe("(W)/(L)");
        expect(normaliseMath("\\sqrt{2}")).toBe("√(2)");
        expect(normaliseMath("\\dfrac{a}{b}")).toBe("(a)/(b)");
    });

    it("turns operator commands into the character they mean", () => {
        expect(normaliseMath("2 \\times 3")).toBe("2 × 3");
        expect(normaliseMath("a \\approx b")).toBe("a ≈ b");
        expect(normaliseMath("\\sigma_c \\leq 0.45 f_{ck}")).toBe(
            "σ_c ≤ 0.45 f_ck",
        );
    });

    it("keeps the underscore of a subscript", () => {
        // `f_{ck}` means the identifier `f_ck`; dropping the underscore would
        // silently rename the symbol.
        expect(normaliseMath("f_{ck}")).toBe("f_ck");
        expect(normaliseMath("x_{max}")).toBe("x_max");
    });

    it("collapses superscript braces that have a single-character form", () => {
        expect(normaliseMath("m^{2}")).toBe("m²");
        expect(normaliseMath("m^{3}")).toBe("m³");
        // Anything else keeps the caret so the exponent is still readable.
        expect(normaliseMath("10^{6}")).toBe("10^6");
    });

    it("strips inline-maths delimiters when the contents are a formula", () => {
        expect(normaliseMath("$V = L \\times B$")).toBe("V = L × B");
        expect(normaliseMath("$$E = mc^2$$")).toBe("E = mc^2");
    });

    it("leaves currency alone", () => {
        // A price is not a formula, so the dollars must survive.
        expect(normaliseMath("The rate is $250 per m³.")).toBe(
            "The rate is $250 per m³.",
        );
    });

    it("is a no-op on ordinary prose", () => {
        const prose = "Mix M25 at 1 : 1 : 2 by volume.";
        expect(normaliseMath(prose)).toBe(prose);
    });
});

describe("parseInline", () => {
    it("reads bold, italic and inline code", () => {
        expect(parseInline("**a** *b* `c`")).toEqual([
            { kind: "strong", content: [{ kind: "text", text: "a" }] },
            { kind: "text", text: " " },
            { kind: "em", content: [{ kind: "text", text: "b" }] },
            { kind: "text", text: " " },
            { kind: "code", text: "c" },
        ]);
    });

    it("keeps underscores inside identifiers from becoming emphasis", () => {
        // `f_ck` and `f_yk` are identifiers, not italic text. Underscore is not
        // an emphasis delimiter here for exactly this reason.
        expect(text(parseInline("f_ck and f_yk"))).toBe("f_ck and f_yk");
        expect(parseInline("c_b = w_c")).toEqual([
            { kind: "text", text: "c_b = w_c" },
        ]);
    });

    it("does not treat underscores as bold either", () => {
        expect(text(parseInline("__not bold__"))).toBe("__not bold__");
    });

    it("reads markdown links and bare URLs", () => {
        expect(parseInline("[Mix Design](/calc/concrete-mix-design)")).toEqual([
            {
                kind: "link",
                href: "/calc/concrete-mix-design",
                content: [{ kind: "text", text: "Mix Design" }],
            },
        ]);

        expect(text(parseInline("see https://example.com/x now"))).toBe(
            "see [https://example.com/x](https://example.com/x) now",
        );
    });

    it("unwraps autolinks", () => {
        expect(parseInline("<https://example.com>")).toEqual([
            {
                kind: "link",
                href: "https://example.com",
                content: [{ kind: "text", text: "https://example.com" }],
            },
        ]);
    });

    it("nests emphasis inside a link label", () => {
        expect(parseInline("[**Mix** Design](/calc/x)")).toEqual([
            {
                kind: "link",
                href: "/calc/x",
                content: [
                    {
                        kind: "strong",
                        content: [{ kind: "text", text: "Mix" }],
                    },
                    { kind: "text", text: " Design" },
                ],
            },
        ]);
    });
});

describe("parseMarkdown blocks", () => {
    it("returns nothing for blank input", () => {
        expect(parseMarkdown("")).toEqual([]);
        expect(parseMarkdown("\n\n   \n")).toEqual([]);
    });

    it("parses headings and clamps the level in the renderer, not the parser", () => {
        expect(parseMarkdown("## Concrete")).toEqual([
            {
                kind: "heading",
                level: 2,
                content: [{ kind: "text", text: "Concrete" }],
            },
        ]);
    });

    it("joins a wrapped paragraph into one block", () => {
        const blocks = parseMarkdown("First line\nsecond line\n\nSecond para");
        expect(blocks).toHaveLength(2);
        expect(blocks[0]).toEqual({
            kind: "paragraph",
            content: [{ kind: "text", text: "First line second line" }],
        });
    });

    it("parses bullets with depth from indentation", () => {
        const [list] = parseMarkdown("- one\n- two\n  - nested");
        expect(list.kind).toBe("list");
        if (list.kind !== "list") return;

        expect(list.ordered).toBe(false);
        expect(list.items.map((i) => i.depth)).toEqual([0, 0, 1]);
        expect(text(list.items[2].content)).toBe("nested");
    });

    it("detects an ordered list", () => {
        const [list] = parseMarkdown("1. first\n2. second");
        expect(list.kind).toBe("list");
        if (list.kind !== "list") return;
        expect(list.ordered).toBe(true);
        expect(list.items).toHaveLength(2);
    });

    it("folds an indented continuation line into the item above it", () => {
        const [list] = parseMarkdown("- a long item that\n  continues here");
        expect(list.kind).toBe("list");
        if (list.kind !== "list") return;
        expect(list.items).toHaveLength(1);
        expect(text(list.items[0].content)).toBe(
            "a long item that continues here",
        );
    });

    it("parses a fenced code block and keeps its interior verbatim", () => {
        const [block] = parseMarkdown(
            "```js\nconst a = 1;\n\nconst b = 2;\n```",
        );
        expect(block).toEqual({
            kind: "codeBlock",
            language: "js",
            text: "const a = 1;\n\nconst b = 2;",
        });
    });

    it("closes an unterminated code fence at the end of the input", () => {
        const [block] = parseMarkdown("```\nvalue = 3");
        expect(block).toEqual({
            kind: "codeBlock",
            language: "",
            text: "value = 3",
        });
    });

    it("parses a pipe table and pads short rows to the header width", () => {
        const [table] = parseMarkdown(
            "| Grade | Ratio |\n| --- | --- |\n| M25 | 1:1:2 |\n| M20 |",
        );
        expect(table).toEqual({
            kind: "table",
            head: ["Grade", "Ratio"],
            rows: [
                ["M25", "1:1:2"],
                ["M20", ""],
            ],
        });
    });

    it("does not mistake prose containing a pipe for a table", () => {
        const blocks = parseMarkdown("a | b\nno divider here");
        expect(blocks).toHaveLength(1);
        expect(blocks[0].kind).toBe("paragraph");
    });

    it("parses quotes and horizontal rules", () => {
        expect(parseMarkdown("> note this")[0]).toEqual({
            kind: "quote",
            content: [{ kind: "text", text: "note this" }],
        });
        expect(parseMarkdown("---")[0]).toEqual({ kind: "rule" });
    });

    it("does not treat a list dash as a horizontal rule", () => {
        const [block] = parseMarkdown("- 25 mm bar");
        expect(block.kind).toBe("list");
    });

    it("keeps a list and a following paragraph as separate blocks", () => {
        const blocks = parseMarkdown("- one\n- two\n\nAfter the list.");
        expect(blocks.map((b) => b.kind)).toEqual(["list", "paragraph"]);
    });

    it("normalises LaTeX before parsing, so it reaches the renderer as text", () => {
        const [block] = parseMarkdown("\\frac{W}{L} = 25");
        expect(block.kind).toBe("paragraph");
        if (block.kind !== "paragraph") return;
        expect(text(block.content)).toBe("(W)/(L) = 25");
    });
});
