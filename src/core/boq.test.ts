import { describe, expect, it } from "vitest";
import {
    DEFAULT_TERMS,
    computeTotals,
    exportCsv,
    exportText,
    formatMoney,
    formatQuantity,
    largestLine,
    lineAmount,
    moveLine,
    newLine,
    newProject,
} from "./boq";
import type { BoqLine, BoqProject } from "./types";

function projectWith(
    lines: Partial<BoqLine>[],
    terms = DEFAULT_TERMS,
): BoqProject {
    const base = newProject("Test BOQ");
    return {
        ...base,
        lines: lines.map((line, index) =>
            newLine({
                description: `Item ${index + 1}`,
                quantity: 1,
                rate: 100,
                ...line,
            }),
        ),
        terms: { ...terms },
    };
}

describe("lineAmount", () => {
    it("multiplies quantity by rate", () => {
        expect(lineAmount(newLine({ quantity: 3, rate: 250 }))).toBe(750);
    });

    it("treats missing or non-numeric values as zero", () => {
        expect(lineAmount(newLine({ quantity: 0, rate: 500 }))).toBe(0);
        expect(lineAmount(newLine({ quantity: 5, rate: 0 }))).toBe(0);
    });

    it("handles fractional quantities", () => {
        expect(lineAmount(newLine({ quantity: 12.5, rate: 4100 }))).toBeCloseTo(
            51250,
            6,
        );
    });
});

describe("computeTotals", () => {
    it("adds the line amounts into a subtotal", () => {
        const project = projectWith([
            { quantity: 10, rate: 500 },
            { quantity: 5, rate: 200 },
        ]);
        expect(computeTotals(project).subtotal).toBe(6000);
        expect(computeTotals(project).lineCount).toBe(2);
    });

    it("applies contingency and overhead to the subtotal only", () => {
        const project = projectWith([{ quantity: 1, rate: 1000 }], {
            contingency: 10,
            overhead: 20,
            tax: 0,
        });
        const totals = computeTotals(project);
        expect(totals.contingencyAmount).toBe(100);
        expect(totals.overheadAmount).toBe(200);
        expect(totals.beforeTax).toBe(1300);
    });

    it("applies tax after contingency and overhead, not to the bare subtotal", () => {
        const project = projectWith([{ quantity: 1, rate: 1000 }], {
            contingency: 10,
            overhead: 20,
            tax: 10,
        });
        const totals = computeTotals(project);
        // 1000 + 100 + 200 = 1300, then 10% tax = 130.
        expect(totals.taxAmount).toBe(130);
        expect(totals.grandTotal).toBeCloseTo(1430, 6);
    });

    it("returns zero totals for an empty bill", () => {
        const project = { ...newProject("Empty"), lines: [] as BoqLine[] };
        const totals = computeTotals(project);
        expect(totals.subtotal).toBe(0);
        expect(totals.grandTotal).toBe(0);
        expect(totals.lineCount).toBe(0);
    });

    it("does not divide by zero when every percentage is zero", () => {
        const project = projectWith([{ quantity: 1, rate: 500 }], {
            contingency: 0,
            overhead: 0,
            tax: 0,
        });
        expect(computeTotals(project).grandTotal).toBe(500);
    });

    it("counts only priced or described lines", () => {
        const project = projectWith([
            { quantity: 2, rate: 100 },
            { description: "", quantity: 0, rate: 0 },
            { description: "Contingency item", quantity: 0, rate: 0 },
        ]);
        // The fully blank row is not part of the bill.
        expect(computeTotals(project).lineCount).toBe(2);
    });

    it("accumulates quantities per unit", () => {
        const project = projectWith([
            { quantity: 10, unit: "m³" },
            { quantity: 5.5, unit: "m³" },
            { quantity: 40, unit: "m²" },
        ]);
        const { quantityByUnit } = computeTotals(project);
        expect(quantityByUnit["m³"]).toBeCloseTo(15.5, 6);
        expect(quantityByUnit["m²"]).toBe(40);
    });

    it("labels a blank unit rather than dropping the quantity", () => {
        const project = projectWith([{ quantity: 7, unit: "" }]);
        expect(computeTotals(project).quantityByUnit["—"]).toBe(7);
    });

    it("never returns NaN for absurd percentages", () => {
        const project = projectWith([{ quantity: 1, rate: 100 }], {
            contingency: Number.NaN,
            overhead: Number.POSITIVE_INFINITY,
            tax: Number.NaN,
        });
        const totals = computeTotals(project);
        for (const value of Object.values(totals)) {
            if (typeof value === "number")
                expect(Number.isNaN(value)).toBe(false);
        }
    });
});

describe("largestLine", () => {
    it("finds the highest-value line and its share", () => {
        const project = projectWith([
            { description: "Small", quantity: 1, rate: 100 },
            { description: "Big", quantity: 1, rate: 900 },
        ]);
        const biggest = largestLine(project);
        expect(biggest?.line.description).toBe("Big");
        expect(biggest?.share).toBeCloseTo(90, 6);
    });

    it("returns null for an empty bill", () => {
        expect(largestLine({ ...newProject("Empty"), lines: [] })).toBeNull();
    });

    it("reports zero share rather than NaN when the bill is worth nothing", () => {
        const project = projectWith([{ quantity: 0, rate: 0 }]);
        expect(largestLine(project)?.share).toBe(0);
    });
});

describe("moveLine", () => {
    const lines = [
        newLine({ id: "a" }),
        newLine({ id: "b" }),
        newLine({ id: "c" }),
    ];

    it("moves an item up", () => {
        expect(moveLine(lines, 1, 0).map((l) => l.id)).toEqual(["b", "a", "c"]);
    });

    it("moves an item down", () => {
        expect(moveLine(lines, 0, 2).map((l) => l.id)).toEqual(["b", "c", "a"]);
    });

    it("does not mutate the original array", () => {
        const copy = [...lines];
        moveLine(lines, 0, 2);
        expect(lines).toEqual(copy);
    });

    it("ignores out-of-range moves", () => {
        expect(moveLine(lines, -1, 0)).toBe(lines);
        expect(moveLine(lines, 0, 9)).toBe(lines);
        expect(moveLine(lines, 5, 0)).toBe(lines);
    });

    it("is a no-op when the position does not change", () => {
        expect(moveLine(lines, 1, 1)).toBe(lines);
    });
});

describe("newProject and newLine", () => {
    it("starts a project with one blank line and the default terms", () => {
        const project = newProject("Tender A");
        expect(project.name).toBe("Tender A");
        expect(project.lines).toHaveLength(1);
        expect(project.terms).toEqual(DEFAULT_TERMS);
    });

    it("gives every line a unique id", () => {
        const ids = [newLine().id, newLine().id, newLine().id];
        expect(new Set(ids).size).toBe(3);
    });

    it("gives every project a unique id", () => {
        const ids = [newProject("a").id, newProject("b").id];
        expect(new Set(ids).size).toBe(2);
    });

    it("lets a partial override the defaults", () => {
        const line = newLine({
            description: "Excavation",
            quantity: 12,
            unit: "m³",
        });
        expect(line.description).toBe("Excavation");
        expect(line.quantity).toBe(12);
        expect(line.unit).toBe("m³");
        expect(line.rate).toBe(0);
    });
});

describe("exportCsv", () => {
    it("includes a header, the project name and every item", () => {
        const project = projectWith([
            { description: "Brickwork", quantity: 10, rate: 4500 },
            { description: "Plaster", quantity: 100, rate: 120 },
        ]);
        const csv = exportCsv(project);
        expect(csv).toContain("Description");
        expect(csv).toContain("Test BOQ");
        expect(csv).toContain("Brickwork");
        expect(csv).toContain("Plaster");
        expect(csv).toContain("GRAND TOTAL");
    });

    it("quotes and escapes embedded double quotes", () => {
        const project = projectWith([
            { description: 'Pipe of 150mm "nominal" bore' },
        ]);
        const csv = exportCsv(project);
        // A literal quote inside a cell must be doubled.
        expect(csv).toContain('""nominal""');
    });

    it("escapes a comma inside a description without breaking the columns", () => {
        const project = projectWith([{ description: "Concrete, M20 grade" }]);
        const csv = exportCsv(project);
        expect(csv).toContain('"Concrete, M20 grade"');
    });

    it("produces a consistent column count on every item row", () => {
        const project = projectWith([
            { description: "A" },
            { description: "B" },
        ]);
        const rows = exportCsv(project).split("\r\n");

        const headerIndex = rows.findIndex(
            (r) => r.startsWith('"Item"') && r.includes("Description"),
        );
        const itemRows = rows
            .slice(headerIndex + 1)
            .filter((r) => r.startsWith('"1"') || r.startsWith('"2"'));

        const counts = itemRows.map((row) => row.split('","').length);
        expect(new Set(counts).size).toBe(1);
    });

    it("states the currency so the figures are unambiguous", () => {
        const project = { ...newProject("X"), currency: "USD" };
        expect(exportCsv(project)).toContain("Rate (USD)");
    });
    it("writes exactly one header row, never one field per line", () => {
        const csv = exportCsv(projectWith([{ description: "A" }]));
        const rows = csv.split("\r\n");

        // A line consisting of a single quoted field is the broken-header defect.
        const strayFields = rows.filter((r) => /^"[^",]*"$/.test(r));
        expect(strayFields).toEqual([]);

        const headerRows = rows.filter((r) =>
            r.startsWith('"Item","Description"'),
        );
        expect(headerRows).toHaveLength(1);
        // The header must be one row containing all seven columns.
        expect(headerRows[0].split('","')).toHaveLength(7);
    });

    it("keeps the project block and the table separated by a blank line", () => {
        const rows = exportCsv(projectWith([{ description: "A" }])).split(
            "\r\n",
        );
        const headerIndex = rows.findIndex((r) =>
            r.startsWith('"Item","Description"'),
        );
        expect(headerIndex).toBeGreaterThan(0);
        expect(rows[headerIndex - 1]).toBe("");
    });
});

describe("exportText", () => {
    it("shows the grand total and skips untouched rows", () => {
        const project = projectWith([
            { description: "Priced item", quantity: 2, rate: 500 },
            { description: "", quantity: 0, rate: 0 },
        ]);
        const text = exportText(project);
        expect(text).toContain("GRAND TOTAL");
        expect(text).toContain("Priced item");
        expect(text).toContain("Subtotal");
    });

    it("does not crash on an empty bill", () => {
        const text = exportText({ ...newProject("Empty"), lines: [] });
        expect(text).toContain("GRAND TOTAL");
    });

    it("keeps every line within the requested width", () => {
        const project = projectWith([
            { description: "A very long description ".repeat(6) },
        ]);
        const lines = exportText(project, 78).split("\n");
        // Only the description line itself may run long, and it is wrapped by the caller.
        for (const line of lines) {
            expect(line.length).toBeLessThanOrEqual(80);
        }
    });

    it("right-aligns the amounts in a consistent column", () => {
        const project = projectWith([{ quantity: 1, rate: 1000 }]);
        const lines = exportText(project, 78).split("\n");
        const total = lines[lines.length - 1];
        expect(total.startsWith("GRAND TOTAL")).toBe(true);
        expect(total.length).toBe(78);
    });
});

describe("formatting", () => {
    it("formats money to two decimals with thousands separators", () => {
        expect(formatMoney(1234567.5)).toBe("1,234,567.50");
    });

    it("appends a currency label when given one", () => {
        expect(formatMoney(100, "BDT")).toBe("100.00 BDT");
    });

    it("trims noisy quantity decimals", () => {
        expect(formatQuantity(12.5)).toBe("12.5");
        expect(formatQuantity(12.500000001)).toBe("12.5");
    });

    it("handles zero and negatives", () => {
        expect(formatMoney(0)).toBe("0.00");
        expect(formatQuantity(0)).toBe("0");
        expect(formatMoney(-500)).toBe("-500.00");
    });
});
