import type {
    CalcResult,
    CalcValues,
    Calculator,
    ComputedRow,
    InputField,
} from "./types";
import { defaultUnit, formatNum, toBase } from "./format";

/** Raw state held by the calculator screen. */
export type RawValues = Record<string, number | boolean>;
export type UnitSelection = Record<string, string>;

export function initialValue(field: InputField): number | boolean {
    if (field.default !== undefined) return field.default;
    if (field.kind === "bool") return false;
    if (field.kind === "select") return field.options?.[0]?.value ?? 0;
    if (field.min !== undefined && field.min > 0) return field.min;
    return 0;
}

export function initialValues(calc: Calculator): RawValues {
    const out: RawValues = {};
    for (const f of calc.inputs) out[f.key] = initialValue(f);
    return out;
}

export function initialUnits(calc: Calculator): UnitSelection {
    const out: UnitSelection = {};
    for (const f of calc.inputs) out[f.key] = defaultUnit(f);
    return out;
}

function asNumber(v: number | boolean | undefined): number {
    if (typeof v === "boolean") return v ? 1 : 0;
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
}

/**
 * Convert the UI state into SI base units.
 * Each calculator's `compute` and `chart` therefore never deal with units — only
 * magnitudes — which keeps the arithmetic explicit and testable.
 */
export function toSiValues(
    calc: Calculator,
    raw: RawValues,
    units: UnitSelection,
): CalcValues {
    const si: CalcValues = {};

    for (const f of calc.inputs) {
        const n = asNumber(raw[f.key]);
        if (f.kind === "select" || f.kind === "bool") {
            si[f.key] = n;
        } else {
            si[f.key] = toBase(f, n, units[f.key] ?? defaultUnit(f));
        }
    }

    return si;
}

/**
 * Convert the UI state into SI base units and run the calculator.
 * The `compute` function therefore never deals with units — only magnitudes.
 */
export function runCalculator(
    calc: Calculator,
    raw: RawValues,
    units: UnitSelection,
): ComputedRow[] {
    const si = toSiValues(calc, raw, units);

    let result: CalcResult;
    try {
        result = calc.compute(si);
    } catch {
        result = {};
    }

    return calc.outputs.map((field) => {
        const raw = result[field.key];

        if (typeof raw === "string") {
            return { field, value: NaN, isText: true, text: raw };
        }

        // Outputs arrive already expressed in `field.unit` — the engine does not
        // convert them, which keeps every calculator's arithmetic explicit.
        const value = Number(raw);
        const safe = Number.isFinite(value) ? value : NaN;
        return {
            field,
            value: safe,
            text: formatNum(safe, field.decimals),
        };
    });
}

/** One-line human summary of the inputs, used in history entries. */
export function describeInputs(
    calc: Calculator,
    raw: RawValues,
    units: UnitSelection,
): string {
    return calc.inputs
        .filter((f) => f.kind !== "bool")
        .map((f) => {
            const v = raw[f.key];
            if (f.kind === "select") {
                const opt = f.options?.find((o) => o.value === asNumber(v));
                return `${f.label}: ${opt?.label ?? v}`;
            }
            const u =
                f.quantity && f.quantity !== "none"
                    ? ` ${units[f.key] ?? ""}`
                    : "";
            return `${f.label}: ${formatNum(asNumber(v))}${u}`;
        })
        .join(" · ");
}

export function heroRow(rows: ComputedRow[]): ComputedRow | undefined {
    return rows.find((r) => r.field.hero) ?? rows[0];
}
