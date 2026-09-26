import type { Quantity } from "./types";

/**
 * A unit knows how to move a value to and from the SI base unit of its quantity.
 *
 * Base units used internally:
 *   length -> m | area -> m2 | volume -> m3 | mass -> kg | force -> N
 *   pressure -> Pa | density -> kg/m3 | unitWeight -> N/m3 | flow -> m3/s
 *   velocity -> m/s | time -> s | angle -> rad | temperature -> degC
 */
export interface UnitDef {
    id: string;
    label: string;
    toBase: (v: number) => number;
    fromBase: (v: number) => number;
}

const linear = (id: string, label: string, factor: number): UnitDef => ({
    id,
    label,
    toBase: (v) => v * factor,
    fromBase: (v) => v / factor,
});

/**
 * Common unit sets reused by many quantities so the UI stays consistent.
 * Metric first (this is a civil engineering tool aimed at metric practice),
 * imperial second.
 */
const LENGTH = [
    linear("m", "m", 1),
    linear("mm", "mm", 0.001),
    linear("cm", "cm", 0.01),
    linear("km", "km", 1000),
    linear("in", "in", 0.0254),
    linear("ft", "ft", 0.3048),
    linear("yd", "yd", 0.9144),
];

export const UNIT_GROUPS: Record<Exclude<Quantity, "none">, UnitDef[]> = {
    length: LENGTH,

    area: [
        linear("m2", "m²", 1),
        linear("mm2", "mm²", 1e-6),
        linear("cm2", "cm²", 1e-4),
        linear("km2", "km²", 1e6),
        linear("ha", "ha", 10000),
        linear("acre", "acre", 4046.8564224),
        linear("ft2", "ft²", 0.09290304),
        linear("in2", "in²", 0.00064516),
        linear("yd2", "yd²", 0.83612736),
    ],

    volume: [
        linear("m3", "m³", 1),
        linear("L", "litre", 0.001),
        linear("mL", "mL", 1e-6),
        linear("cm3", "cm³", 1e-6),
        linear("mm3", "mm³", 1e-9),
        linear("ft3", "ft³", 0.028316846592),
        linear("in3", "in³", 1.6387064e-5),
        linear("yd3", "yd³", 0.764554857984),
        linear("galUS", "US gal", 0.003785411784),
        linear("galUK", "UK gal", 0.00454609),
    ],

    mass: [
        linear("kg", "kg", 1),
        linear("g", "g", 0.001),
        linear("mg", "mg", 1e-6),
        linear("t", "tonne", 1000),
        linear("lb", "lb", 0.45359237),
        linear("oz", "oz", 0.028349523125),
    ],

    force: [
        linear("N", "N", 1),
        linear("kN", "kN", 1000),
        linear("MN", "MN", 1e6),
        linear("kgf", "kgf", 9.80665),
        linear("tf", "tonnef", 9806.65),
        linear("lbf", "lbf", 4.4482216152605),
        linear("kip", "kip", 4448.2216152605),
    ],

    pressure: [
        linear("Pa", "Pa", 1),
        linear("kPa", "kPa", 1000),
        linear("MPa", "MPa", 1e6),
        linear("Nmm2", "N/mm²", 1e6),
        linear("kNm2", "kN/m²", 1000),
        linear("bar", "bar", 1e5),
        linear("kgcm2", "kg/cm²", 98066.5),
        linear("psi", "psi", 6894.757293168),
        linear("ksf", "ksf", 47880.258980335),
    ],

    density: [
        linear("kgm3", "kg/m³", 1),
        linear("gcm3", "g/cm³", 1000),
        linear("tm3", "t/m³", 1000),
        linear("lbft3", "lb/ft³", 16.01846337396),
    ],

    unitWeight: [
        linear("Nm3", "N/m³", 1),
        linear("kNm3", "kN/m³", 1000),
        linear("kgm3uw", "kg/m³", 9.80665),
        linear("pcf", "lb/ft³", 157.0874638),
    ],

    flow: [
        linear("m3s", "m³/s", 1),
        linear("m3h", "m³/h", 1 / 3600),
        linear("Ls", "L/s", 0.001),
        linear("Lmin", "L/min", 1 / 60000),
        linear("MLD", "MLD", 1000 / 86400),
        linear("ft3s", "ft³/s", 0.028316846592),
        linear("gpm", "US gpm", 0.003785411784 / 60),
    ],

    velocity: [
        linear("ms", "m/s", 1),
        linear("kmh", "km/h", 1 / 3.6),
        linear("mph", "mph", 0.44704),
        linear("fts", "ft/s", 0.3048),
    ],

    time: [
        linear("s", "s", 1),
        linear("min", "min", 60),
        linear("h", "h", 3600),
        linear("day", "day", 86400),
    ],

    angle: [
        linear("deg", "°", Math.PI / 180),
        linear("rad", "rad", 1),
        linear("grad", "grad", Math.PI / 200),
    ],

    // Temperature is affine, so it needs real functions rather than a factor.
    temperature: [
        { id: "C", label: "°C", toBase: (v) => v, fromBase: (v) => v },
        {
            id: "F",
            label: "°F",
            toBase: (v) => ((v - 32) * 5) / 9,
            fromBase: (v) => (v * 9) / 5 + 32,
        },
        {
            id: "K",
            label: "K",
            toBase: (v) => v - 273.15,
            fromBase: (v) => v + 273.15,
        },
    ],

    money: [
        linear("unit", "per unit", 1),
        linear("thousand", "per 1,000", 1000),
        linear("lakh", "per lakh", 100000),
        linear("million", "per million", 1e6),
    ],
};

export function findUnit(
    quantity: Quantity | undefined,
    unitId: string,
): UnitDef | undefined {
    if (!quantity || quantity === "none") return undefined;
    return UNIT_GROUPS[quantity].find((u) => u.id === unitId);
}

export function unitsFor(field: {
    quantity?: Quantity;
    allowedUnits?: string[];
}): UnitDef[] {
    if (!field.quantity || field.quantity === "none") return [];
    const all = UNIT_GROUPS[field.quantity];
    if (!field.allowedUnits?.length) return all;
    return all.filter((u) => field.allowedUnits!.includes(u.id));
}
