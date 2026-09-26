import type { InputField, Quantity } from "./types";
import { findUnit, unitsFor } from "./units";

/** Precision that adapts to magnitude — avoids 0.0000001 noise on big numbers. */
function autoDecimals(v: number): number {
    const a = Math.abs(v);
    if (a === 0) return 0;
    if (a >= 1000) return 2;
    if (a >= 1) return 3;
    if (a >= 0.001) return 4;
    return 6;
}

export function formatNum(v: number, decimals?: number): string {
    if (!Number.isFinite(v)) return "—";
    const d = decimals ?? autoDecimals(v);
    return v.toLocaleString("en-US", {
        minimumFractionDigits: 0,
        maximumFractionDigits: d,
    });
}

/** Compact notation for long lists (totals above 100,000 become "1.23 L"). */
export function formatCompact(v: number): string {
    if (!Number.isFinite(v)) return "—";
    const abs = Math.abs(v);
    if (abs >= 1e7) return `${formatNum(v / 1e7, 3)} Cr`;
    if (abs >= 1e5) return `${formatNum(v / 1e5, 3)} L`;
    if (abs >= 1e3) return `${formatNum(v / 1e3, 3)} K`;
    return formatNum(v);
}

export function defaultUnit(field: InputField): string {
    const list = unitsFor(field);
    if (!list.length) return "";
    if (field.defaultUnit && list.some((u) => u.id === field.defaultUnit))
        return field.defaultUnit;
    return list[0].id;
}

export function unitLabel(
    quantity: Quantity | undefined,
    unitId: string,
): string {
    const u = findUnit(quantity, unitId);
    return u ? u.label : "";
}

/** Convert a raw user value into the SI base unit. */
export function toBase(field: InputField, raw: number, unitId: string): number {
    if (field.kind === "select" || field.kind === "bool") return raw;
    const u = findUnit(field.quantity, unitId);
    return u ? u.toBase(raw) : raw;
}

/** Convert an SI value into the requested display unit. */
export function fromBase(
    quantity: Quantity | undefined,
    unitId: string,
    base: number,
): number {
    const u = findUnit(quantity, unitId);
    return u ? u.fromBase(base) : base;
}

export function clamp(v: number, min?: number, max?: number): number {
    let out = v;
    if (min !== undefined && out < min) out = min;
    if (max !== undefined && out > max) out = max;
    return out;
}

/**
 * Display suffix for an output row: the real unit label when the output carries
 * a quantity, otherwise whatever literal was given (e.g. "bags", "%", "kN/m").
 */
export function outputUnit(field: {
    quantity?: Quantity;
    unit?: string;
}): string {
    if (field.quantity && field.quantity !== "none" && field.unit) {
        return unitLabel(field.quantity, field.unit);
    }
    return field.unit ?? "";
}
