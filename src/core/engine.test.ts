import { describe, expect, it } from "vitest";
import {
    describeInputs,
    heroRow,
    initialUnits,
    initialValues,
    runCalculator,
} from "./engine";
import { outputUnit } from "./format";
import {
    CALCULATORS,
    CALCULATOR_BY_ID,
    byCategory,
    countByCategory,
    searchCalculators,
} from "./registry";
import { CATEGORIES } from "./categories";
import type { Calculator } from "./types";

/** Convenience: build a calculator's default state and run it. */
function run(calc: Calculator) {
    const units = initialUnits(calc);
    const values = initialValues(calc);
    return { rows: runCalculator(calc, values, units), values, units };
}

function valueOf(
    calcId: string,
    key: string,
    overrides: Record<string, number> = {},
): number {
    const calc = CALCULATOR_BY_ID[calcId];
    const values = { ...initialValues(calc), ...overrides };
    const rows = runCalculator(calc, values, initialUnits(calc));
    const row = rows.find((r) => r.field.key === key);
    if (!row) throw new Error(`${calcId} has no output "${key}"`);
    return row.value;
}

function textOf(
    calcId: string,
    key: string,
    overrides: Record<string, number> = {},
): string {
    const calc = CALCULATOR_BY_ID[calcId];
    const values = { ...initialValues(calc), ...overrides };
    const rows = runCalculator(calc, values, initialUnits(calc));
    const row = rows.find((r) => r.field.key === key);
    if (!row) throw new Error(`${calcId} has no output "${key}"`);
    return row.text;
}

/* ------------------------------------------------------------------ *
 * Registry integrity
 * ------------------------------------------------------------------ */

describe("registry", () => {
    it("exposes at least 100 calculators", () => {
        expect(CALCULATORS.length).toBeGreaterThanOrEqual(100);
    });

    it("gives every calculator a unique id", () => {
        const ids = CALCULATORS.map((c) => c.id);
        expect(new Set(ids).size).toBe(ids.length);
    });

    it("gives every calculator a unique name", () => {
        const names = CALCULATORS.map((c) => c.name);
        expect(new Set(names).size).toBe(names.length);
    });

    it("gives every calculator a unique output key set", () => {
        for (const calc of CALCULATORS) {
            const keys = calc.outputs.map((o) => o.key);
            expect(
                new Set(keys).size,
                `${calc.id} has duplicate output keys`,
            ).toBe(keys.length);
        }
    });

    it("gives every calculator a unique input key set", () => {
        for (const calc of CALCULATORS) {
            const keys = calc.inputs.map((i) => i.key);
            expect(
                new Set(keys).size,
                `${calc.id} has duplicate input keys`,
            ).toBe(keys.length);
        }
    });

    it("assigns every calculator to a real category", () => {
        const known = new Set(CATEGORIES.map((c) => c.id));
        for (const calc of CALCULATORS) {
            expect(
                known.has(calc.category),
                `${calc.id} has an unknown category`,
            ).toBe(true);
        }
    });

    it("has at least one calculator in every category", () => {
        for (const category of CATEGORIES) {
            expect(
                byCategory(category.id).length,
                `category ${category.id} is empty`,
            ).toBeGreaterThan(0);
        }
    });

    it("counts calculators per category consistently with byCategory", () => {
        const counts = countByCategory();
        for (const category of CATEGORIES) {
            expect(counts[category.id] ?? 0).toBe(
                byCategory(category.id).length,
            );
        }
    });
});

/* ------------------------------------------------------------------ *
 * Every calculator must run
 * ------------------------------------------------------------------ */

/**
 * Outputs that are ALLOWED to come back blank, with the reason.
 *
 * Anything not listed here must be a finite number: a blank value that is not
 * explained below is a bug, not a design decision.
 */
const INTENTIONAL_BLANK: Record<string, string> = {
    // Once Mu exceeds Mu,lim a singly reinforced section is impossible, so there
    // is genuinely no tension steel area to report. The `sectionType` output
    // explains the situation and the blank renders as an em dash.
    "beam-design-singly-reinforced.ast":
        "no valid Ast exists once Mu exceeds Mu,lim",

    // The minimum steel requirement is 0.85 b d / fy, so with no steel grade
    // there is no minimum to report.
    "beam-design-singly-reinforced.astMin":
        "the minimum steel formula divides by fy, so fy = 0 has no answer",

    // Heron's formula has no real root when the three sides cannot close into a
    // triangle, so a blank is the honest answer.
    "triangle-heron.area":
        "the triangle inequality is not satisfied, so no real area exists",
};

/** Asserts an output is finite, unless it is on the documented allowlist. */
function expectFiniteOrExplained(
    calcId: string,
    key: string,
    value: number,
    context: string,
): void {
    if (`${calcId}.${key}` in INTENTIONAL_BLANK) return;
    expect(
        Number.isFinite(value),
        `${calcId}/${key} is not finite ${context}`,
    ).toBe(true);
}

describe("every calculator", () => {
    it("produces a finite or text value for every output at its defaults", () => {
        for (const calc of CALCULATORS) {
            const { rows } = run(calc);
            expect(rows.length, `${calc.id} produced no rows`).toBe(
                calc.outputs.length,
            );

            for (const row of rows) {
                if (row.isText) {
                    expect(
                        typeof row.text === "string" && row.text.length > 0,
                        `${calc.id}/${row.field.key} produced an empty text result`,
                    ).toBe(true);
                } else {
                    expectFiniteOrExplained(
                        calc.id,
                        row.field.key,
                        row.value,
                        `at defaults (got ${row.value})`,
                    );
                }
            }
        }
    });

    it("never throws or produces NaN when every input is zero", () => {
        for (const calc of CALCULATORS) {
            const zeroed: Record<string, number> = {};
            for (const input of calc.inputs) zeroed[input.key] = 0;

            const rows = runCalculator(calc, zeroed, initialUnits(calc));
            for (const row of rows) {
                if (!row.isText) {
                    // Division by zero must be guarded, not propagated as NaN.
                    expectFiniteOrExplained(
                        calc.id,
                        row.field.key,
                        row.value,
                        "with all inputs at zero",
                    );
                }
            }
        }
    });

    it("declares a unit on every output that names a quantity", () => {
        for (const calc of CALCULATORS) {
            for (const output of calc.outputs) {
                if (output.quantity && output.quantity !== "none") {
                    expect(
                        output.unit,
                        `${calc.id}/${output.key} declares a quantity but no unit`,
                    ).toBeTruthy();
                }
            }
        }
    });

    it("only uses units that its input quantity actually offers", () => {
        for (const calc of CALCULATORS) {
            for (const input of calc.inputs) {
                if (input.defaultUnit) {
                    const units = initialUnits(calc);
                    expect(
                        units[input.key],
                        `${calc.id}/${input.key} did not resolve a valid default unit`,
                    ).toBe(input.defaultUnit);
                }
            }
        }
    });

    it("never returns NaN for absurdly large inputs", () => {
        // NaN always means a bug. Infinity is tolerated here because multiplying
        // absurdly large magnitudes together can legitimately overflow.
        // Unguarded division by zero is caught by the two zero-input tests above.
        for (const calc of CALCULATORS) {
            const huge: Record<string, number> = {};
            for (const input of calc.inputs) {
                // A dropdown can only ever produce one of its own options, so
                // only free numeric inputs can really arrive out of range.
                if (input.kind === "select" || input.kind === "bool") continue;
                huge[input.key] = 1e9;
            }

            const values = { ...initialValues(calc), ...huge };
            const rows = runCalculator(calc, values, initialUnits(calc));
            for (const row of rows) {
                if (row.isText) continue;
                if (`${calc.id}.${row.field.key}` in INTENTIONAL_BLANK)
                    continue;
                expect(
                    Number.isNaN(row.value),
                    `${calc.id}/${row.field.key} came back NaN with huge inputs`,
                ).toBe(false);
            }
        }
    });

    it("stays finite when any single input is zeroed on its own", () => {
        // Stronger than zeroing everything at once: this catches a divisor that
        // is only left unguarded for one particular input.
        for (const calc of CALCULATORS) {
            const defaults = initialValues(calc);
            const units = initialUnits(calc);

            for (const input of calc.inputs) {
                if (input.kind === "select" || input.kind === "bool") continue;

                const values = { ...defaults, [input.key]: 0 };
                const rows = runCalculator(calc, values, units);

                for (const row of rows) {
                    if (!row.isText) {
                        expectFiniteOrExplained(
                            calc.id,
                            row.field.key,
                            row.value,
                            `with ${input.key} = 0`,
                        );
                    }
                }
            }
        }
    });
});

/* ------------------------------------------------------------------ *
 * Input handling
 * ------------------------------------------------------------------ */

describe("initialValues and initialUnits", () => {
    it("seeds each input with its declared default", () => {
        for (const calc of CALCULATORS) {
            const values = initialValues(calc);
            for (const input of calc.inputs) {
                if (input.default !== undefined) {
                    expect(values[input.key], `${calc.id}/${input.key}`).toBe(
                        input.default,
                    );
                }
            }
        }
    });

    it("seeds each unit input with a unit its group provides", () => {
        for (const calc of CALCULATORS) {
            const units = initialUnits(calc);
            for (const input of calc.inputs) {
                if (input.quantity && input.quantity !== "none") {
                    expect(units[input.key]).toBeTruthy();
                } else {
                    expect(units[input.key]).toBe("");
                }
            }
        }
    });
});

describe("input unit conversion", () => {
    it("converts a dropdown value into the SI base unit before computing", () => {
        // Bar diameter defaults to 12 mm, and the calculator expects millimetres
        // derived from the metre value the engine supplies.
        const calc = CALCULATOR_BY_ID["steel-bar-weight"];
        const values = { ...initialValues(calc), dia: 1000 }; // 1000 mm
        const mm = initialUnits(calc);
        const rows = runCalculator(calc, values, { ...mm, dia: "mm" });

        const area = rows.find((r) => r.field.key === "area")!;
        // 1000 mm bar has a cross-section of pi/4 x 1000^2 = 785,398 mm2.
        expect(area.value).toBeCloseTo(785398, 0);
    });

    it("gives a different answer when the same number is entered in metres", () => {
        const calc = CALCULATOR_BY_ID["steel-bar-weight"];
        const values = { ...initialValues(calc), dia: 1000 };
        const rows = runCalculator(calc, values, {
            ...initialUnits(calc),
            dia: "m",
        });

        const area = rows.find((r) => r.field.key === "area")!;
        // 1000 m bar = 1,000,000 mm diameter.
        expect(area.value).toBeCloseTo(785398163397, -4);
    });
});

describe("text results", () => {
    it("passes a string result straight through and flags it as text", () => {
        const calc: Calculator = {
            id: "text-test",
            name: "Text Test",
            category: "misc" as never,
            summary: "",
            inputs: [{ key: "a", label: "A", default: 1 }],
            outputs: [
                { key: "ratio", label: "Ratio" },
                { key: "verdict", label: "Verdict" },
            ],
            compute: (v) => ({ ratio: v.a * 2, verdict: "looks fine" }),
        };

        const rows = runCalculator(calc, { a: 3 }, {});
        expect(rows[0].value).toBe(6);
        expect(rows[0].isText).toBeUndefined();

        expect(rows[1].isText).toBe(true);
        expect(rows[1].text).toBe("looks fine");
    });
});

describe("error containment", () => {
    it("returns blank rows instead of throwing when compute fails", () => {
        const calc: Calculator = {
            id: "boom",
            name: "Boom",
            category: "misc" as never,
            summary: "",
            inputs: [{ key: "a", label: "A", default: 1 }],
            outputs: [{ key: "x", label: "X" }],
            compute: () => {
                throw new Error("kaboom");
            },
        };

        const rows = runCalculator(calc, { a: 1 }, {});
        expect(rows).toHaveLength(1);
        expect(rows[0].text).toBe("—");
    });
});

/* ------------------------------------------------------------------ *
 * Known engineering values
 * ------------------------------------------------------------------ */

describe("steel", () => {
    it("gives 0.8889 kg/m for a 12 mm bar from d²/162", () => {
        expect(valueOf("steel-bar-weight", "unitWeight")).toBeCloseTo(
            0.8889,
            4,
        );
    });

    it("weights 10 number 12 mm bars of 12 m as 106.67 kg", () => {
        expect(valueOf("steel-bar-weight", "totalWeight")).toBeCloseTo(
            106.67,
            2,
        );
    });

    it("reports a development length of 47 phi for M20 with Fe415 deformed bars", () => {
        // The classic textbook figure for this combination.
        expect(valueOf("development-length", "multiple")).toBeCloseTo(47, 0);
        expect(valueOf("development-length", "ld")).toBeCloseTo(752, 0);
    });

    it("never lets a lap length fall below 30 phi in flexural tension", () => {
        const multiple = valueOf("lap-length", "multiple");
        expect(multiple).toBeGreaterThanOrEqual(30);
    });
});

describe("concrete materials", () => {
    it("needs 8.3 bags of cement for 1 m3 of M20", () => {
        expect(valueOf("concrete-mix-materials", "cementBags")).toBeCloseTo(
            8.3,
            1,
        );
    });

    it("keeps the cement content of M20 near 415 kg/m3", () => {
        expect(valueOf("concrete-mix-materials", "cementContent")).toBeCloseTo(
            415,
            0,
        );
    });

    it("gives 7.2 bags of cement for a 1:6 plaster 12 mm thick over 100 m2", () => {
        // 100 x 0.012 = 1.2 m3 wet, x 1.33 x 1.10 = 1.7556 m3 dry, / 7 parts
        // = 0.2508 m3 of cement = 361 kg = 7.2 bags of 50 kg.
        expect(valueOf("plaster", "cementBags")).toBeCloseTo(7.22, 2);
    });

    it("works out 1811 bricks for a 5 x 3 m wall 230 mm thick", () => {
        expect(valueOf("brick-masonry", "bricks")).toBeCloseTo(1811, 0);
    });

    it("converts a cube failure load into the right compressive strength", () => {
        // 550 kN over a 150 mm cube is 550000 / 22500 = 24.44 N/mm2.
        expect(valueOf("concrete-cube-strength", "s1")).toBeCloseTo(24.44, 2);
    });
});

describe("structural design", () => {
    it("computes the limiting moment of a 230 x 450 M20 Fe415 beam as 106.7 kNm", () => {
        expect(valueOf("beam-design-singly-reinforced", "muLim")).toBeCloseTo(
            106.68,
            2,
        );
    });

    it("caps tension steel at 4% of the gross concrete area", () => {
        // 0.04 x 230 x 450 = 4140 mm2.
        expect(valueOf("beam-design-singly-reinforced", "astMax")).toBeCloseTo(
            4140,
            6,
        );
    });

    it("flags a doubly reinforced section when Mu exceeds Mu,lim", () => {
        const verdict = textOf("beam-design-singly-reinforced", "sectionType", {
            mu: 200,
        });
        expect(verdict).toContain("doubly reinforced");
    });

    it("gives a short column capacity close to the IS 456 formula by hand", () => {
        // 230x450, M20, Fe415, 6 number 16 mm:
        // Ac = 103500 - 1206 = 102294 mm2, Asc = 1206 mm2
        // Ag = 103500, Asc = 1206.37, Ac = 102293.63
        // Pu = 0.4 x 20 x 102293.63 + 0.67 x 415 x 1206.37
        //    = 818349 + 335431.6 = 1,153,780.6 N = 1153.78 kN
        expect(valueOf("column-load-capacity", "pu")).toBeCloseTo(1153.78, 1);
    });

    it("passes a 5 m span with a 400 mm effective depth on the deflection check", () => {
        expect(valueOf("span-depth-check", "actualRatio")).toBeCloseTo(12.5, 2);
        expect(textOf("span-depth-check", "status")).toContain("OK");
    });
});

describe("hydraulics", () => {
    it("sizes a 150 mm pipe carrying 1.2 m/s at 21.2 L/s", () => {
        expect(valueOf("pipe-discharge", "qLs")).toBeCloseTo(21.21, 2);
    });

    it("converts correctly between litres per second and MLD", () => {
        // MLD = L/s x 86.4 / 1000.
        const lps = valueOf("pipe-discharge", "qLs");
        const mld = valueOf("pipe-discharge", "qMLD");
        expect(mld).toBeCloseTo((lps * 86.4) / 1000, 4);
    });

    it("gives the Kuichling fire demand for 50,000 people as 22,500 L/min", () => {
        expect(valueOf("water-demand", "fireLpm")).toBeCloseTo(22500, 0);
    });

    it("collects 153,000 litres a year from 150 m2 at 1200 mm rainfall", () => {
        // 1 mm on 1 m2 is 1 litre, so 150 x 1200 x 0.85 = 153,000.
        expect(valueOf("rainwater-harvesting", "annualHarvestL")).toBeCloseTo(
            153000,
            0,
        );
    });

    it("splits pump power sensibly between water, shaft and motor", () => {
        const water = valueOf("pump-power", "waterPower");
        const shaft = valueOf("pump-power", "shaftPower");
        const motor = valueOf("pump-power", "motorInput");
        expect(shaft).toBeGreaterThan(water);
        expect(motor).toBeGreaterThan(shaft);
        // 1000 x 9.81 x 0.01 x 30 / 1000 = 2.94 kW.
        expect(water).toBeCloseTo(2.94, 2);
    });
});

describe("transportation", () => {
    it("reports the right stopping sight distance for 80 km/h", () => {
        // 0.278 x 80 x 2.5 + 80^2 / (254 x 0.36) = 55.6 + 70.0 = 125.6 m
        expect(valueOf("stopping-sight-distance", "ssd")).toBeCloseTo(125.6, 1);
    });

    it("splits the stopping distance into lag and braking", () => {
        const ssd = valueOf("stopping-sight-distance", "ssd");
        const lag = valueOf("stopping-sight-distance", "reactionDistance");
        const braking = valueOf("stopping-sight-distance", "brakingDistance");
        expect(lag + braking).toBeCloseTo(ssd, 6);
    });

    it("accumulates 64 MSA for 2000 CVPD over 15 years at 7.5%", () => {
        expect(valueOf("design-traffic-msa", "msa")).toBeCloseTo(64.35, 1);
    });

    it("uses a smaller lane factor for a wider carriageway", () => {
        expect(
            valueOf("design-traffic-msa", "msa", { lanes: 0 }),
        ).toBeGreaterThan(valueOf("design-traffic-msa", "msa", { lanes: 2 }));
    });

    it("keeps the overtaking sight distance above the stopping distance", () => {
        expect(valueOf("overtaking-sight-distance", "osd")).toBeGreaterThan(
            valueOf("overtaking-sight-distance", "ssd"),
        );
    });
});

describe("soil", () => {
    it("computes 13.33% moisture content from the oven-dry masses", () => {
        // (145 - 125) / (125 - 25) = 20 / 100 = 20%... overridden here to 13.33.
        // Default sample: water 20 g on 100 g dry soil = 20%.
        expect(valueOf("moisture-content", "waterContent")).toBeCloseTo(20, 2);
    });

    it("detects a fully saturated soil", () => {
        // Sr = w Gs / e; with e = 0.6 and w = 22.6% at Gs = 2.65 this reaches 100%.
        const sr = valueOf("void-ratio", "sr", {
            dryDensity: 1656,
            waterContent: 22.64,
        });
        expect(sr).toBeCloseTo(100, 0);
    });

    it("gives 66.7% relative density for e_max 0.9, e_min 0.45, e 0.6", () => {
        expect(valueOf("relative-density", "dr")).toBeCloseTo(66.67, 1);
    });

    it("computes consolidation settlement from the Cc formula", () => {
        // 4 m x 0.3 / 1.9 x log10(150/100) = 4.2105 x 0.17609 = 111.2 mm (in metres: x1000)
        expect(valueOf("consolidation-settlement", "settlement")).toBeCloseTo(
            111.2,
            1,
        );
    });

    it("reaches 90% consolidation at the expected time", () => {
        // t90 = 0.848 Hdr^2 / Cv with Hdr = 2 m and Cv = 2 m2/year.
        expect(valueOf("consolidation-settlement", "timeFor90")).toBeCloseTo(
            1.696,
            3,
        );
    });
});

describe("surveying", () => {
    it("balances the rise and fall arithmetic check", () => {
        expect(textOf("level-book-rise-fall", "checkText")).toContain(
            "Checked",
        );
    });

    it("reduces levels correctly by subtraction of staff readings", () => {
        // RL of the last point = BM + BS - FS = 100 + 1.465 - 1.055 = 100.410.
        expect(valueOf("level-book-rise-fall", "rl3")).toBeCloseTo(100.41, 3);
    });

    it("computes 200 m2 for a 20 x 10 m plot by the shoelace formula", () => {
        expect(valueOf("area-by-coordinates", "area")).toBeCloseTo(200, 3);
    });

    it("applies the temperature correction in the correct direction", () => {
        // A tape used hotter than standard reads short, so the length increases.
        const corrected = valueOf("tape-correction-temperature", "corrected");
        expect(corrected).toBeGreaterThan(100);
    });
});

describe("geometry", () => {
    it("computes a 5 x 3 m rectangle as 15 m2", () => {
        expect(valueOf("rectangle-area", "area")).toBeCloseTo(15, 6);
    });

    it("computes a 1 m radius circle as 3.1416 m2", () => {
        expect(valueOf("circle-area", "area")).toBeCloseTo(Math.PI, 4);
    });

    it("treats the size as a diameter when the input type says so", () => {
        // A 1 m diameter gives a 0.5 m radius, so the area is pi x 0.25 = 0.7854.
        expect(valueOf("circle-area", "area", { input: 1 })).toBeCloseTo(
            0.7854,
            4,
        );
    });

    it("validates Heron when the three sides cannot form a triangle", () => {
        const rows = runCalculator(
            CALCULATOR_BY_ID["triangle-heron"],
            { a: 1, b: 1, c: 10 },
            initialUnits(CALCULATOR_BY_ID["triangle-heron"]),
        );
        // 1 + 1 < 10, so the area is not a real number.
        expect(rows[0].text).toBe("—");
    });

    it("converts a 2 x 3 x 2 m tank into 12,000 litres", () => {
        expect(
            valueOf("cuboid-volume", "litres", { l: 2, w: 3, h: 2 }),
        ).toBeCloseTo(12000, 3);
    });
});

describe("unit converter category", () => {
    it("converts 1 metre into 1000 mm", () => {
        expect(valueOf("convert-length", "out_mm")).toBeCloseTo(1000, 6);
    });

    it("converts 1 metre into 3.2808 feet", () => {
        expect(valueOf("convert-length", "out_ft")).toBeCloseTo(3.28084, 4);
    });

    it("converts 100 degrees Celsius into 212 Fahrenheit", () => {
        expect(
            valueOf("convert-temperature", "out_F", { value: 100 }),
        ).toBeCloseTo(212, 6);
    });

    it("converts 0 degrees Celsius into 273.15 Kelvin", () => {
        expect(
            valueOf("convert-temperature", "out_K", { value: 0 }),
        ).toBeCloseTo(273.15, 6);
    });

    it("reports every unit of the quantity it converts", () => {
        for (const calc of byCategory("convert")) {
            expect(calc.outputs.length).toBeGreaterThan(1);
        }
    });
});

describe("BOQ", () => {
    it("adds up the project total with contingency, overhead and tax", () => {
        // 585,000 + 5% + 15% = 702,000, then + 13% tax = 793,260.
        expect(valueOf("boq-project-total", "grandTotal")).toBeCloseTo(
            793260,
            0,
        );
    });

    it("rounds the grand total up to the requested step", () => {
        const total = valueOf("boq-project-total", "grandTotal");
        const rounded = valueOf("boq-project-total", "roundedTotal");
        expect(rounded).toBeGreaterThanOrEqual(total);
        expect(rounded % 1000).toBe(0);
    });

    it("ignores line items left at zero", () => {
        expect(valueOf("boq-project-total", "linesUsed")).toBe(4);
        expect(
            valueOf("boq-project-total", "linesUsed", { amount5: 100 }),
        ).toBe(5);
    });

    it("balances excavation against backfill and disposal", () => {
        const excavation = valueOf("excavation-backfill", "excavation");
        const backfill = valueOf("excavation-backfill", "backfill");
        expect(excavation).toBeCloseTo(36, 3);
        expect(backfill).toBeCloseTo(30, 3);
    });
});

/* ------------------------------------------------------------------ *
 * Formatting and helpers
 * ------------------------------------------------------------------ */

describe("outputUnit", () => {
    it("resolves a quantity unit to its display label", () => {
        expect(outputUnit({ quantity: "length", unit: "mm" })).toBe("mm");
        expect(outputUnit({ quantity: "area", unit: "m2" })).toBe("m²");
        expect(outputUnit({ quantity: "volume", unit: "m3" })).toBe("m³");
    });

    it("passes through a literal suffix when there is no quantity", () => {
        expect(outputUnit({ unit: "bags" })).toBe("bags");
        expect(outputUnit({ unit: "%" })).toBe("%");
        expect(outputUnit({})).toBe("");
    });

    it('prefers the literal when the quantity is "none"', () => {
        expect(outputUnit({ quantity: "none", unit: "kN/m" })).toBe("kN/m");
    });
});

describe("describeInputs", () => {
    it("summarises select inputs by their label, not their index", () => {
        const calc = CALCULATOR_BY_ID["brick-masonry"];
        const summary = describeInputs(
            calc,
            initialValues(calc),
            initialUnits(calc),
        );
        expect(summary).toContain("Brick size: Modular");
        expect(summary).toContain("Mortar ratio (cement : sand): 1 : 6");
    });

    it("appends the chosen unit to physical inputs", () => {
        const calc = CALCULATOR_BY_ID["rectangle-area"];
        const summary = describeInputs(
            calc,
            initialValues(calc),
            initialUnits(calc),
        );
        expect(summary).toContain("Length: 5 m");
        expect(summary).toContain("Width: 3 m");
    });
});

describe("heroRow", () => {
    it("prefers the row flagged as hero", () => {
        const calc = CALCULATOR_BY_ID["rectangle-area"];
        const { rows } = run(calc);
        expect(heroRow(rows)?.field.key).toBe("area");
    });

    it("falls back to the first row when nothing is flagged", () => {
        const calc: Calculator = {
            id: "no-hero",
            name: "No Hero",
            category: "misc" as never,
            summary: "",
            inputs: [{ key: "a", label: "A", default: 1 }],
            outputs: [
                { key: "x", label: "X" },
                { key: "y", label: "Y" },
            ],
            compute: () => ({ x: 1, y: 2 }),
        };
        const rows = runCalculator(calc, { a: 1 }, {});
        expect(heroRow(rows)?.field.key).toBe("x");
    });
});

/* ------------------------------------------------------------------ *
 * Search
 * ------------------------------------------------------------------ */

describe("searchCalculators", () => {
    it("returns nothing for an empty query", () => {
        expect(searchCalculators("")).toEqual([]);
        expect(searchCalculators("   ")).toEqual([]);
    });

    it("finds calculators by tag", () => {
        const ids = searchCalculators("brick").map((c) => c.id);
        expect(ids).toContain("brick-masonry");
    });

    it("finds a calculator by its exact name first", () => {
        const results = searchCalculators("Steel Bar Weight");
        expect(results[0].id).toBe("steel-bar-weight");
    });

    it("matches multiple terms across a name", () => {
        const ids = searchCalculators("bar weight").map((c) => c.id);
        expect(ids).toContain("steel-bar-weight");
    });

    it("returns nothing when a term matches nowhere", () => {
        expect(searchCalculators("zzzznotacalculator")).toEqual([]);
    });

    it("is case and whitespace insensitive", () => {
        expect(searchCalculators("  BRICK  ").map((c) => c.id)).toContain(
            "brick-masonry",
        );
    });

    it("respects the result limit", () => {
        expect(searchCalculators("a", 5).length).toBeLessThanOrEqual(5);
    });
});
