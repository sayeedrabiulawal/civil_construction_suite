import type { SelectOption } from "@/core/types";

/**
 * Shared engineering constants, mix tables and helpers.
 * Kept in one place so a change in a code reference updates every calculator.
 */

export const BAG_KG = 50;
export const CEMENT_DENSITY = 1440;
export const SAND_DENSITY = 1550;
export const AGG_DENSITY = 1500;
export const CONCRETE_DENSITY = 2500;
export const STEEL_DENSITY = 7850;

/** Standard gravitational acceleration (m/s²). */
export const G = 9.80665;

/* ------------------------------------------------------------------ *
 * Cement mortar ratios
 * ------------------------------------------------------------------ */

export const MORTAR_RATIOS: {
    value: number;
    label: string;
    cement: number;
    sand: number;
}[] = [
    { value: 0, label: "1 : 3", cement: 1, sand: 3 },
    { value: 1, label: "1 : 4", cement: 1, sand: 4 },
    { value: 2, label: "1 : 5", cement: 1, sand: 5 },
    { value: 3, label: "1 : 6", cement: 1, sand: 6 },
    { value: 4, label: "1 : 8", cement: 1, sand: 8 },
];

export const MORTAR_OPTIONS: SelectOption[] = MORTAR_RATIOS.map((r) => ({
    value: r.value,
    label: r.label,
}));

/* ------------------------------------------------------------------ *
 * Nominal concrete mixes — IS 456:2000, Table 9
 * ------------------------------------------------------------------ */

export const NOMINAL_MIXES: {
    value: number;
    label: string;
    cement: number;
    sand: number;
    agg: number;
}[] = [
    { value: 0, label: "M5 (1 : 5 : 10)", cement: 1, sand: 5, agg: 10 },
    { value: 1, label: "M7.5 (1 : 4 : 8)", cement: 1, sand: 4, agg: 8 },
    { value: 2, label: "M10 (1 : 3 : 6)", cement: 1, sand: 3, agg: 6 },
    { value: 3, label: "M15 (1 : 2 : 4)", cement: 1, sand: 2, agg: 4 },
    { value: 4, label: "M20 (1 : 1.5 : 3)", cement: 1, sand: 1.5, agg: 3 },
    { value: 5, label: "M25 (1 : 1 : 2)", cement: 1, sand: 1, agg: 2 },
];

export const NOMINAL_MIX_OPTIONS: SelectOption[] = NOMINAL_MIXES.map((m) => ({
    value: m.value,
    label: m.label,
}));

export interface ConcreteMaterials {
    cementKg: number;
    cementBags: number;
    sandM3: number;
    sandKg: number;
    aggM3: number;
    aggKg: number;
    waterL: number;
    dryVolume: number;
    cementContent: number;
}

/**
 * Materials for a wet (plastic) volume of nominal-mix concrete.
 * The 1.54 factor turns wet concrete volume into the dry loose volume of ingredients.
 */
export function concreteMaterials(
    wetVolumeM3: number,
    mixIndex: number,
    options: { dryFactor?: number; wastage?: number; wc?: number } = {},
): ConcreteMaterials {
    const dryFactor = options.dryFactor ?? 1.54;
    const wastage = options.wastage ?? 0;
    const wc = options.wc ?? 0.5;

    const dryVolume = wetVolumeM3 * dryFactor * (1 + wastage / 100);
    const m =
        NOMINAL_MIXES[
            Math.min(Math.max(mixIndex, 0), NOMINAL_MIXES.length - 1)
        ];
    const parts = m.cement + m.sand + m.agg;

    const cementVolume = (dryVolume * m.cement) / parts;
    const sandVolume = (dryVolume * m.sand) / parts;
    const aggVolume = (dryVolume * m.agg) / parts;
    const cementKg = cementVolume * CEMENT_DENSITY;

    return {
        cementKg,
        cementBags: cementKg / BAG_KG,
        sandM3: sandVolume,
        sandKg: sandVolume * SAND_DENSITY,
        aggM3: aggVolume,
        aggKg: aggVolume * AGG_DENSITY,
        waterL: cementKg * wc,
        dryVolume,
        cementContent: wetVolumeM3 > 0 ? cementKg / wetVolumeM3 : 0,
    };
}

/** Steel mass (kg) estimated from a percentage of the concrete volume. */
export function steelFromVolumePercentage(
    volumeM3: number,
    percentage: number,
): number {
    return volumeM3 * (percentage / 100) * STEEL_DENSITY;
}

/* ------------------------------------------------------------------ *
 * Reinforcement — IS 456:2000 Cl. 26.2.1.1
 * ------------------------------------------------------------------ */

/** Bond stress τbd for plain bars in tension (MPa) — IS 456:2000 Cl. 26.2.1.1. */
const TBD_BY_GRADE = [1.2, 1.4, 1.5, 1.7, 1.9, 1.9, 2.0];

export function bondStress(gradeIndex: number): number {
    return TBD_BY_GRADE[
        Math.min(Math.max(gradeIndex, 0), TBD_BY_GRADE.length - 1)
    ];
}

/**
 * IS 456:2000 Cl. 26.2.1.1 — the tabulated bond stress is for plain bars in tension.
 *   deformed bars in tension  -> +60%
 *   any bars in compression   -> +25%
 */
export function bondStressMultiplier(
    barType: number,
    condition: number,
): number {
    if (condition === 2) return 1.25;
    return barType === 1 ? 1.6 : 1.0;
}

/** Unit weight of a round bar (kg/m) using the familiar d²/162 rule of thumb. */
export function barUnitWeight(diameterMm: number): number {
    return (diameterMm * diameterMm) / 162;
}

/** Exact cross-sectional area of a round bar (mm²). */
export function barArea(diameterMm: number): number {
    return (Math.PI / 4) * diameterMm * diameterMm;
}
