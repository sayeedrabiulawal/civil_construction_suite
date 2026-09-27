/**
 * A tiny read-only markdown subset, dependency-free.
 *
 * The assistant answers in markdown, and the site only needs two things from
 * it: readable engineering prose, and links back into the app's calculators.
 * A full CommonMark implementation is a dependency and a bundle cost for that,
 * so this parses exactly the subset the system prompt asks the model to emit —
 * headings, paragraphs, lists, fenced code, quotes, rules and pipe tables.
 *
 * One deliberate departure from CommonMark: `_underscores_` is NOT emphasis.
 * In this domain `_` is a subscript, and treating it as a delimiter turns every
 * `f_ck`, `c_b` and `w_c` in an answer into mangled italic text. The prompt asks
 * for `*asterisks*`, so dropping the underscore form costs nothing and prevents
 * the commoner failure.
 *
 * Like the rest of `core/`, this returns DATA, never HTML: the tree is mapped
 * onto React elements by `components/Markdown.tsx`, so model output can never
 * be interpreted as markup.
 */

/* ------------------------------- Types ------------------------------- */

export type MdInline =
    | { kind: "text"; text: string }
    | { kind: "strong"; content: MdInline[] }
    | { kind: "em"; content: MdInline[] }
    | { kind: "code"; text: string }
    | { kind: "link"; href: string; content: MdInline[] };

export interface MdListItem {
    content: MdInline[];
    /** 0 for a top-level bullet, 1 for one indent step in. */
    depth: number;
}

export type MdBlock =
    | { kind: "heading"; level: number; content: MdInline[] }
    | { kind: "paragraph"; content: MdInline[] }
    | { kind: "list"; ordered: boolean; items: MdListItem[] }
    | { kind: "codeBlock"; language: string; text: string }
    | { kind: "quote"; content: MdInline[] }
    | { kind: "table"; head: string[]; rows: string[][] }
    | { kind: "rule" };

/** The deepest nesting the renderer indents for. */
const MAX_LIST_DEPTH = 2;

/* ------------------------------ LaTeX guard ------------------------------ */

/**
 * The system prompt asks for plain-text maths (`m³`, `×`, `√`), but a model
 * will occasionally leak LaTeX anyway. Rather than render `\\frac{a}{b}` to the
 * user, the common constructs are folded down to the characters they mean.
 *
 * Deliberately conservative: `$` is only treated as a delimiter when the text
 * between a pair actually looks like a formula, so ordinary prices survive.
 */
export function normaliseMath(source: string): string {
    return (
        source
            .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
            .replace(/\\dfrac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, "($1)/($2)")
            .replace(/\\sqrt\s*\{([^{}]*)\}/g, "√($1)")
            .replace(/\\text\s*\{([^{}]*)\}/g, "$1")
            .replace(/\^\s*\{2\}/g, "²")
            .replace(/\^\s*\{3\}/g, "³")
            .replace(/\^\s*\{([^{}]*)\}/g, "^$1")
            // The underscore is kept: `f_{ck}` means the identifier `f_ck`, and
            // dropping it would read as a different symbol entirely.
            .replace(/_\s*\{([^{}]*)\}/g, "_$1")
            .replace(/\\(?:left|right|quad|qquad|,|;|!|:)/g, " ")
            .replace(/\\\[|\\\]|\\\(|\\\)/g, "")
            // `(?![A-Za-z])` rather than `\b`: the commands below are routinely
            // followed by a subscript, as in `\sigma_c`, and `_` is a word
            // character, so a word boundary would never match there.
            .replace(/\\times(?![A-Za-z])/g, "×")
            .replace(/\\div(?![A-Za-z])/g, "÷")
            .replace(/\\cdot(?![A-Za-z])/g, "·")
            .replace(/\\approx(?![A-Za-z])/g, "≈")
            .replace(/\\neq(?![A-Za-z])/g, "≠")
            .replace(/\\leq(?![A-Za-z])/g, "≤")
            .replace(/\\geq(?![A-Za-z])/g, "≥")
            .replace(/\\pm(?![A-Za-z])/g, "±")
            .replace(/\\rho(?![A-Za-z])/g, "ρ")
            .replace(/\\sigma(?![A-Za-z])/g, "σ")
            .replace(/\\phi(?![A-Za-z])/g, "φ")
            .replace(/\\pi(?![A-Za-z])/g, "π")
            .replace(/\\alpha(?![A-Za-z])/g, "α")
            .replace(/\\beta(?![A-Za-z])/g, "β")
            .replace(/\\gamma(?![A-Za-z])/g, "γ")
            .replace(/\\Delta(?![A-Za-z])/g, "Δ")
            .replace(/\$\$([^$\n]+)\$\$/g, unwrapIfFormula)
            .replace(/\$([^$\n]+)\$/g, unwrapIfFormula)
    );
}

function unwrapIfFormula(_match: string, inner: string): string {
    return /[\\^_=]|\d\s*[a-zA-Z]/.test(inner) ? inner : `$${inner}$`;
}

/* -------------------------------- Parser -------------------------------- */

const FENCE = /^ {0,3}```\s*([\w+#.-]*)\s*$/;
const HEADING = /^ {0,3}(#{1,6})\s+(.*?)\s*#*\s*$/;
const RULE = /^ {0,3}(?:-\s*){3,}$|^ {0,3}(?:\*\s*){3,}$|^ {0,3}(?:_\s*){3,}$/;
const BULLET = /^(\s*)([-*+]|\d{1,3}[.)])\s+(.*)$/;
const TABLE_DIVIDER = /^\s*\|?\s*:?-{2,}:?\s*(?:\|\s*:?-{2,}:?\s*)*\|?\s*$/;

export function parseMarkdown(source: string): MdBlock[] {
    const lines = normaliseMath(source).replace(/\r\n?/g, "\n").split("\n");
    const blocks: MdBlock[] = [];
    let i = 0;

    while (i < lines.length) {
        const line = lines[i];

        if (!line.trim()) {
            i += 1;
            continue;
        }

        const fence = FENCE.exec(line);
        if (fence) {
            const body: string[] = [];
            i += 1;
            while (i < lines.length && !/^ {0,3}```\s*$/.test(lines[i])) {
                body.push(lines[i]);
                i += 1;
            }
            i += 1; // past the closing fence, or past the end of input
            blocks.push({
                kind: "codeBlock",
                language: fence[1] ?? "",
                text: body.join("\n"),
            });
            continue;
        }

        if (RULE.test(line)) {
            blocks.push({ kind: "rule" });
            i += 1;
            continue;
        }

        const heading = HEADING.exec(line);
        if (heading) {
            blocks.push({
                kind: "heading",
                // Deeper levels are rendered smaller; the level itself is kept
                // so the renderer can pick the right tag.
                level: heading[1].length,
                content: parseInline(heading[2]),
            });
            i += 1;
            continue;
        }

        const table = readTable(lines, i);
        if (table) {
            blocks.push(table.block);
            i = table.next;
            continue;
        }

        if (/^ {0,3}>/.test(line)) {
            const quoted: string[] = [];
            while (i < lines.length && /^ {0,3}>/.test(lines[i])) {
                quoted.push(lines[i].replace(/^ {0,3}>\s?/, ""));
                i += 1;
            }
            blocks.push({
                kind: "quote",
                content: parseInline(quoted.join(" ").trim()),
            });
            continue;
        }

        const bullet = BULLET.exec(line);
        if (bullet) {
            const ordered = /\d/.test(bullet[2]);
            // Indentation of the first bullet defines the baseline, so a list
            // that is wholly indented still renders flush left.
            const baseIndent = bullet[1].length;
            const items: MdListItem[] = [];

            while (i < lines.length) {
                const match = BULLET.exec(lines[i]);
                if (match) {
                    const indent = match[1].length;
                    const depth =
                        indent <= baseIndent
                            ? 0
                            : Math.min(
                                  Math.round((indent - baseIndent) / 2),
                                  MAX_LIST_DEPTH,
                              );
                    items.push({ content: parseInline(match[3]), depth });
                    i += 1;
                    continue;
                }

                // A wrapped or indented continuation line belongs to the item
                // above it rather than starting a new block.
                const continuation = lines[i];
                if (
                    continuation.trim() &&
                    /^\s{2,}/.test(continuation) &&
                    items.length > 0 &&
                    !startsBlock(lines, i)
                ) {
                    const last = items[items.length - 1];
                    last.content = [
                        ...last.content,
                        { kind: "text", text: " " },
                        ...parseInline(continuation.trim()),
                    ];
                    i += 1;
                    continue;
                }

                break;
            }

            blocks.push({ kind: "list", ordered, items });
            continue;
        }

        const paragraph: string[] = [line.trim()];
        i += 1;
        while (i < lines.length && lines[i].trim() && !startsBlock(lines, i)) {
            paragraph.push(lines[i].trim());
            i += 1;
        }
        blocks.push({
            kind: "paragraph",
            content: parseInline(paragraph.join(" ")),
        });
    }

    return blocks;
}

/** True when the line at `index` opens a block of its own. */
function startsBlock(lines: string[], index: number): boolean {
    const line = lines[index];
    if (FENCE.test(line) || RULE.test(line) || HEADING.test(line)) return true;
    if (BULLET.test(line)) return true;
    if (/^ {0,3}>/.test(line)) return true;
    return isTableStart(lines, index);
}

function isTableStart(lines: string[], index: number): boolean {
    const head = lines[index];
    const divider = lines[index + 1];
    if (!head || !divider) return false;
    return head.includes("|") && TABLE_DIVIDER.test(divider);
}

function readTable(
    lines: string[],
    start: number,
): { block: MdBlock; next: number } | null {
    if (!isTableStart(lines, start)) return null;

    const head = splitRow(lines[start]);
    const rows: string[][] = [];
    let i = start + 2;

    while (i < lines.length && lines[i].trim() && lines[i].includes("|")) {
        rows.push(splitRow(lines[i]));
        i += 1;
    }

    // Every row is padded to the header width so the renderer never has to
    // reason about ragged tables the model produced.
    const width = head.length;
    const padded = rows.map((row) => {
        const cells = row.slice(0, width);
        while (cells.length < width) cells.push("");
        return cells;
    });

    return { block: { kind: "table", head, rows: padded }, next: i };
}

function splitRow(line: string): string[] {
    return line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((cell) => cell.trim());
}

/* ------------------------------ Inline level ------------------------------ */

const INLINE =
    /(`+)([\s\S]*?)\1|\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)|\*\*([\s\S]+?)\*\*|\*([^*\n]+?)\*|(https?:\/\/[^\s<>()]+)/;

export function parseInline(source: string): MdInline[] {
    // `<https://…>` is an autolink; drop the brackets and let the URL rule run.
    let rest = source.replace(/<(https?:\/\/[^>\s]+)>/g, "$1");
    const nodes: MdInline[] = [];

    for (;;) {
        const match = INLINE.exec(rest);
        if (!match) break;

        if (match.index > 0) {
            nodes.push({ kind: "text", text: rest.slice(0, match.index) });
        }

        const [, , code, label, href, strong, em, bare] = match;

        if (code !== undefined) nodes.push({ kind: "code", text: code.trim() });
        else if (href !== undefined)
            nodes.push({
                kind: "link",
                href,
                content: parseInline(label || href),
            });
        else if (strong !== undefined)
            nodes.push({ kind: "strong", content: parseInline(strong) });
        else if (em !== undefined)
            nodes.push({ kind: "em", content: parseInline(em) });
        else if (bare !== undefined)
            nodes.push({
                kind: "link",
                href: bare,
                content: [{ kind: "text", text: bare }],
            });

        rest = rest.slice(match.index + match[0].length);
    }

    if (rest) nodes.push({ kind: "text", text: rest });
    return nodes;
}
