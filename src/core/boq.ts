import type { BoqLine, BoqProject, BoqTerms, BoqTotals } from "./types";

/**
 * Pure BOQ logic. No React, no storage — so it is all directly testable.
 */

export const DEFAULT_TERMS: BoqTerms = {
    contingency: 5,
    overhead: 15,
    tax: 13,
};

/** Units an engineer would actually bill against. */
export const BOQ_UNITS = [
    "m³",
    "m²",
    "m",
    "mm",
    "kg",
    "tonne",
    "nos",
    "bag",
    "litre",
    "LS",
    "day",
    "km",
] as const;

export const DEFAULT_CURRENCY = "BDT";

/** Guard a number so a half-typed field or a stray paste cannot poison the totals. */
function safe(value: number | string | undefined): number {
    const n = typeof value === "number" ? value : Number(value);
    return Number.isFinite(n) ? n : 0;
}

let idCounter = 0;

/** Unique enough for local use, and stable across a reload. */
export function newId(prefix = "id"): string {
    idCounter += 1;
    return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
        .toString(36)
        .slice(2, 6)}`;
}

export function newLine(partial: Partial<BoqLine> = {}): BoqLine {
    return {
        id: newId("line"),
        description: "",
        unit: "m³",
        quantity: 0,
        rate: 0,
        remarks: "",
        ...partial,
    };
}

export function newProject(
    name: string,
    currency = DEFAULT_CURRENCY,
): BoqProject {
    const now = Date.now();
    return {
        id: newId("boq"),
        name,
        client: "",
        currency,
        lines: [newLine()],
        terms: { ...DEFAULT_TERMS },
        createdAt: now,
        updatedAt: now,
    };
}

/** Amount for one line. */
export function lineAmount(line: BoqLine): number {
    return safe(line.quantity) * safe(line.rate);
}

/** Roll a project's lines up into the totals shown at the foot of the bill. */
export function computeTotals(project: BoqProject): BoqTotals {
    const lines = project.lines;

    let subtotal = 0;
    let lineCount = 0;
    const quantityByUnit: Record<string, number> = {};

    for (const line of lines) {
        const amount = lineAmount(line);
        subtotal += amount;

        // A line counts once it is priced. Blank rows are not part of the bill.
        if (amount !== 0 || line.description.trim() !== "") lineCount += 1;

        const unit = line.unit.trim() || "—";
        quantityByUnit[unit] =
            (quantityByUnit[unit] ?? 0) + safe(line.quantity);
    }

    const contingencyAmount =
        (subtotal * safe(project.terms.contingency)) / 100;
    const overheadAmount = (subtotal * safe(project.terms.overhead)) / 100;
    const beforeTax = subtotal + contingencyAmount + overheadAmount;
    const taxAmount = (beforeTax * safe(project.terms.tax)) / 100;

    return {
        subtotal,
        contingencyAmount,
        overheadAmount,
        beforeTax,
        taxAmount,
        grandTotal: beforeTax + taxAmount,
        lineCount,
        quantityByUnit,
    };
}

/** Which line drives the bill. Useful for sanity-checking an estimate. */
export function largestLine(
    project: BoqProject,
): { line: BoqLine; share: number } | null {
    if (project.lines.length === 0) return null;

    let best = project.lines[0];
    let bestAmount = lineAmount(best);
    for (const line of project.lines) {
        const amount = lineAmount(line);
        if (amount > bestAmount) {
            best = line;
            bestAmount = amount;
        }
    }

    const { subtotal } = computeTotals(project);
    return {
        line: best,
        share: subtotal > 0 ? (bestAmount / subtotal) * 100 : 0,
    };
}

/** Move a line within the bill. Returns a new array; out-of-range moves are no-ops. */
export function moveLine(
    lines: BoqLine[],
    from: number,
    to: number,
): BoqLine[] {
    if (from === to) return lines;
    if (from < 0 || from >= lines.length) return lines;
    if (to < 0 || to >= lines.length) return lines;

    const next = [...lines];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    return next;
}

function pad(value: number): string {
    return value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
}

/** Escape a value for CSV: wrap in quotes and double any embedded quote. */
function csvCell(value: string): string {
    return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Render a project as CSV for Excel or Google Sheets.
 *
 * The layout is: a short project block, a blank line, then a self-contained
 * table with its own header row, then the totals. Each cell is quoted, so
 * descriptions containing commas or quotes survive the round trip.
 */
export function exportCsv(project: BoqProject): string {
    const totals = computeTotals(project);
    const rows: string[] = [];

    rows.push(`${csvCell("Project")},${csvCell(project.name)}`);
    if (project.client)
        rows.push(`${csvCell("Client")},${csvCell(project.client)}`);
    rows.push(`${csvCell("Currency")},${csvCell(project.currency)}`);
    rows.push(
        `${csvCell("Exported")},${csvCell(new Date().toISOString().slice(0, 10))}`,
    );
    rows.push("");

    // A single header row, so the table stands alone when pasted into a sheet.
    rows.push(
        [
            csvCell("Item"),
            csvCell("Description"),
            csvCell("Unit"),
            csvCell("Quantity"),
            csvCell(`Rate (${project.currency})`),
            csvCell(`Amount (${project.currency})`),
            csvCell("Remarks"),
        ].join(","),
    );

    project.lines.forEach((line, index) => {
        rows.push(
            [
                csvCell(String(index + 1)),
                csvCell(line.description),
                csvCell(line.unit),
                csvCell(String(safe(line.quantity))),
                csvCell(pad(safe(line.rate))),
                csvCell(pad(lineAmount(line))),
                csvCell(line.remarks),
            ].join(","),
        );
    });

    rows.push("");
    rows.push(
        [
            csvCell("Subtotal"),
            "",
            "",
            "",
            "",
            csvCell(pad(totals.subtotal)),
        ].join(","),
    );
    rows.push(
        [
            csvCell(`Contingency (${safe(project.terms.contingency)}%)`),
            "",
            "",
            "",
            "",
            csvCell(pad(totals.contingencyAmount)),
        ].join(","),
    );
    rows.push(
        [
            csvCell(`Overhead and profit (${safe(project.terms.overhead)}%)`),
            "",
            "",
            "",
            "",
            csvCell(pad(totals.overheadAmount)),
        ].join(","),
    );
    rows.push(
        [
            csvCell(`Tax (${safe(project.terms.tax)}%)`),
            "",
            "",
            "",
            "",
            csvCell(pad(totals.taxAmount)),
        ].join(","),
    );
    rows.push(
        [
            csvCell("GRAND TOTAL"),
            "",
            "",
            "",
            "",
            csvCell(pad(totals.grandTotal)),
        ].join(","),
    );

    return rows.join("\r\n");
}

/**
 * A plain-text summary suitable for pasting into an email or a report.
 * Amounts are right-aligned in a fixed-width column and long descriptions wrap,
 * so the output stays readable in a plain-text editor or a monospaced email.
 */
export function exportText(project: BoqProject, width = 78): string {
    const totals = computeTotals(project);
    const amountWidth = 16;
    const rule = "-".repeat(width);

    /** Right-align an amount, then a label, in a consistent column. */
    const row = (label: string, amount: number): string => {
        const left =
            label.length > width - amountWidth - 1
                ? label.slice(0, width - amountWidth - 2) + "…"
                : label;
        return (
            left.padEnd(width - amountWidth) + pad(amount).padStart(amountWidth)
        );
    };

    /** Wrap text to `limit` columns, breaking on spaces and indenting continuations. */
    const wrap = (text: string, limit: number, indent = ""): string[] => {
        const words = text.split(/\s+/).filter(Boolean);
        if (words.length === 0) return [indent];

        const out: string[] = [];
        let current = indent;

        for (const word of words) {
            const candidate =
                current === indent ? current + word : `${current} ${word}`;
            if (candidate.length <= limit || current === indent) {
                current = candidate;
            } else {
                out.push(current);
                current = indent + word;
            }
        }
        out.push(current);
        return out;
    };

    const lines: string[] = [];
    lines.push(...wrap(project.name.toUpperCase(), width));
    if (project.client) lines.push(...wrap(project.client, width));
    lines.push(`Currency: ${project.currency}`);
    lines.push(`Date: ${new Date().toLocaleDateString()}`);
    lines.push("");
    lines.push(rule);

    project.lines.forEach((line, index) => {
        // Skip untouched rows so the export does not carry blank lines.
        if (line.description.trim() === "" && lineAmount(line) === 0) return;

        const heading = `${index + 1}. ${line.description || "(no description)"}`;
        lines.push(...wrap(heading, width, index < 9 ? "   " : "    "));

        lines.push(
            `   ${formatQuantity(safe(line.quantity))} ${line.unit} @ ${pad(
                safe(line.rate),
            )} = ${pad(lineAmount(line))}`,
        );
        if (line.remarks) lines.push(...wrap(line.remarks, width - 3, "   "));
    });

    lines.push(rule);
    lines.push(row("Subtotal", totals.subtotal));
    lines.push(
        row(
            `Contingency ${safe(project.terms.contingency)}%`,
            totals.contingencyAmount,
        ),
    );
    lines.push(
        row(
            `Overhead and profit ${safe(project.terms.overhead)}%`,
            totals.overheadAmount,
        ),
    );
    lines.push(row(`Tax ${safe(project.terms.tax)}%`, totals.taxAmount));
    lines.push("=".repeat(width));
    lines.push(row("GRAND TOTAL", totals.grandTotal));

    return lines.join("\n");
}

export function formatMoney(value: number, currency = ""): string {
    const text = value.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return currency ? `${text} ${currency}` : text;
}

/** Quantities are not always clean: 12.5 m³ is fine, 12.5000000001 is not. */
export function formatQuantity(value: number): string {
    return value.toLocaleString("en-US", { maximumFractionDigits: 4 });
}
