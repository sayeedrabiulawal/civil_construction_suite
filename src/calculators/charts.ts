/**
 * Chart builders shared by the calculators.
 *
 * Kept apart from the calculator modules so the engineering formulas stay
 * readable, and so the same curve can be reused by more than one tool.
 */

import type { ChartPoint, ChartSeries, ChartSpec } from "@/core/chart";

/* ------------------------------------------------------------------ *
 * Gradation
 * ------------------------------------------------------------------ */

/** IS 383 standard sieve sizes for fine and coarse aggregate, in mm. */
export const SIEVE_SIZES = [0.15, 0.3, 0.6, 1.18, 2.36, 4.75, 10, 20, 40];

/** The sieves the fineness-modulus calculator measures, smallest last input. */
export const FM_SIEVES = [4.75, 2.36, 1.18, 0.6, 0.3, 0.15] as const;

/**
 * IS 383 Table 4, cumulative percentage PASSING for the four fine-aggregate
 * zones. Each entry is [lower limit, upper limit] at the matching sieve.
 */
export const ZONE_LIMITS: Record<
    string,
    { name: string; limits: [number, number][] }
> = {
    I: {
        name: "Zone I (coarsest)",
        limits: [
            [90, 100],
            [60, 95],
            [30, 70],
            [15, 34],
            [5, 20],
            [0, 10],
        ],
    },
    II: {
        name: "Zone II",
        limits: [
            [90, 100],
            [75, 100],
            [55, 90],
            [35, 59],
            [8, 30],
            [0, 10],
        ],
    },
    III: {
        name: "Zone III",
        limits: [
            [90, 100],
            [85, 100],
            [75, 100],
            [60, 79],
            [12, 40],
            [0, 10],
        ],
    },
    IV: {
        name: "Zone IV (finest)",
        limits: [
            [95, 100],
            [95, 100],
            [90, 100],
            [80, 100],
            [15, 50],
            [0, 15],
        ],
    },
};

/**
 * Gradation curve: percentage passing against sieve size on a log axis, with
 * the IS 383 zone envelope drawn behind it.
 */
export function gradationChart(
    passingBySieve: { sieve: number; passing: number }[],
    zone: keyof typeof ZONE_LIMITS,
    caption: string,
): ChartSpec | null {
    const grade = ZONE_LIMITS[zone];
    if (!grade) return null;

    const series: ChartSeries[] = [];

    // The envelope is drawn as two dashed limit lines.
    series.push({
        name: `IS 383 ${grade.name} — upper limit`,
        tone: "muted",
        dashed: true,
        points: [
            { x: 10, y: 100 },
            ...FM_SIEVES.map((sieve, i) => ({
                x: sieve,
                y: grade.limits[i][1],
            })),
        ].sort((a, b) => a.x - b.x),
    });

    series.push({
        name: "Lower limit",
        tone: "muted",
        dashed: true,
        points: [
            { x: 10, y: 100 },
            ...FM_SIEVES.map((sieve, i) => ({
                x: sieve,
                y: grade.limits[i][0],
            })),
        ].sort((a, b) => a.x - b.x),
    });

    const measured: ChartPoint[] = [
        { x: 10, y: 100 },
        ...passingBySieve.map((p) => ({ x: p.sieve, y: p.passing })),
    ]
        .filter((p) => p.x > 0 && Number.isFinite(p.y))
        .sort((a, b) => a.x - b.x);

    series.push({
        name: "Test result",
        tone: "primary",
        markers: true,
        points: measured,
    });

    return {
        title: "Gradation curve",
        x: {
            label: "Sieve size (mm)",
            scale: "log",
            ticks: [...[...FM_SIEVES].reverse(), 10],
        },
        y: {
            label: "Cumulative % passing",
            min: 0,
            max: 100,
            ticks: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
            format: (v) => `${v}`,
        },
        series,
        caption,
        aspect: 2.1,
    };
}

/* ------------------------------------------------------------------ *
 * Strength gain with age
 * ------------------------------------------------------------------ */

/** The logarithmic strength-age fit used by the maturity calculator. */
export function strengthGainRatio(equivalentDays: number): number {
    if (!(equivalentDays > 0)) return 0;
    return Math.max(0, Math.min(0.3 + 0.484 * Math.log10(equivalentDays), 1));
}

/**
 * Strength gain against equivalent age, with the current curing point marked.
 * The curve is plotted in days on a log axis from 0.5 to 90 days.
 */
export function strengthGainChart(
    equivalentDays: number,
    strengthRatio: number,
): ChartSpec {
    const ages: number[] = [];
    const samples = 48;
    const lo = Math.log10(0.5);
    const hi = Math.log10(90);
    for (let i = 0; i <= samples; i += 1)
        ages.push(10 ** (lo + ((hi - lo) * i) / samples));

    const curve: ChartPoint[] = ages.map((d) => ({
        x: d,
        y: strengthGainRatio(d) * 100,
    }));

    const series: ChartSeries[] = [
        {
            name: "Strength gain (indicative)",
            tone: "primary",
            points: curve,
            area: true,
        },
        {
            name: "28-day reference",
            tone: "muted",
            dashed: true,
            points: [
                { x: 0.5, y: 100 },
                { x: 90, y: 100 },
            ],
        },
    ];

    if (equivalentDays > 0)
        series.push({
            name: "This curing regime",
            tone: "success",
            markers: true,
            points: [{ x: equivalentDays, y: strengthRatio }],
        });

    return {
        title: "Strength gain with curing",
        x: {
            label: "Equivalent age at 20 °C (days)",
            scale: "log",
            ticks: [0.5, 1, 2, 3, 5, 7, 14, 28, 56, 90],
        },
        y: {
            label: "% of the 28-day strength",
            min: 0,
            max: 100,
            ticks: [0, 20, 40, 60, 80, 100],
        },
        series,
        caption:
            "Logarithmic fit for ordinary Portland cement. Calibrate against cube results from the same mix before relying on it for striking formwork.",
        aspect: 2.1,
    };
}

/* ------------------------------------------------------------------ *
 * Traffic growth
 * ------------------------------------------------------------------ */

/** Cumulative design traffic (MSA) year by year over the design life. */
export function trafficGrowthChart(params: {
    cvpd: number;
    growthRatePct: number;
    lanes: number;
    vdf: number;
    life: number;
}): ChartSpec | null {
    const { cvpd, lanes, vdf, life } = params;
    if (!(cvpd > 0) || !(life > 0)) return null;

    const r = Math.min(Math.max(params.growthRatePct, 0), 15) / 100;
    const d = [1.0, 0.75, 0.4][lanes] ?? 0.75;

    const cumulative: ChartPoint[] = [];
    const yearly: ChartPoint[] = [];

    for (let year = 0; year <= life; year += 1) {
        const vehicles =
            r > 0
                ? (365 * cvpd * (Math.pow(1 + r, year) - 1)) / r
                : 365 * cvpd * year;
        cumulative.push({ x: year, y: (vehicles * d * vdf) / 1e6 });
        yearly.push({
            x: year,
            y:
                (365 *
                    cvpd *
                    Math.pow(1 + r, Math.max(year - 1, 0)) *
                    d *
                    vdf) /
                (1e6 * Math.max(year, 1)),
        });
    }

    const finalMsa = cumulative[cumulative.length - 1].y;

    return {
        title: "Design traffic build-up",
        x: {
            label: "Year",
            min: 0,
            max: life,
            format: (v) => `${Math.round(v)}`,
        },
        y: { label: "Cumulative standard axles (MSA)", min: 0 },
        series: [
            {
                name: "Cumulative MSA",
                tone: "primary",
                points: cumulative,
                area: true,
            },
            {
                name: "Design life",
                tone: "danger",
                markers: true,
                points: [{ x: life, y: finalMsa }],
            },
        ],
        caption:
            "IRC 37. The final point is the design traffic the pavement thickness is based on.",
        aspect: 2.1,
    };
}

/* ------------------------------------------------------------------ *
 * Consolidation
 * ------------------------------------------------------------------ */

/** Degree of consolidation at a time factor, inverting the standard Tv–U pair. */
export function degreeOfConsolidation(tv: number): number {
    if (tv <= 0) return 0;
    if (tv <= 0.2827) return Math.min(Math.sqrt((4 * tv) / Math.PI), 1);
    if (tv >= 2.2) return 1;
    return 1 - 10 ** ((1.781 - tv) / 0.933) / 100;
}

/** Settlement against time, on a log time axis, with the current state marked. */
export function settlementTimeChart(params: {
    ultimateSettlementMm: number;
    cv: number;
    drainagePath: number;
    years: number;
    settlementAtTime: number;
}): ChartSpec | null {
    const { ultimateSettlementMm, cv, drainagePath, years } = params;
    if (!(ultimateSettlementMm > 0) || !(drainagePath > 0) || !(cv > 0))
        return null;

    const curve: ChartPoint[] = [];
    const samples = 60;
    const lo = Math.log10(0.01);
    const hi = Math.log10(1000);
    for (let i = 0; i <= samples; i += 1) {
        const t = 10 ** (lo + ((hi - lo) * i) / samples);
        const tv = (cv * t) / (drainagePath * drainagePath);
        curve.push({
            x: t,
            y: degreeOfConsolidation(tv) * ultimateSettlementMm,
        });
    }

    const series: ChartSeries[] = [
        {
            name: "Settlement with time",
            tone: "primary",
            points: curve,
            area: true,
        },
        {
            name: "Ultimate settlement",
            tone: "muted",
            dashed: true,
            points: [
                { x: 0.01, y: ultimateSettlementMm },
                { x: 1000, y: ultimateSettlementMm },
            ],
        },
    ];

    if (years > 0)
        series.push({
            name: "At the selected time",
            tone: "success",
            markers: true,
            points: [{ x: years, y: params.settlementAtTime }],
        });

    return {
        title: "Consolidation settlement with time",
        x: {
            label: "Time since loading (years)",
            scale: "log",
            ticks: [0.01, 0.1, 1, 10, 100, 1000],
        },
        y: {
            label: "Settlement (mm)",
            min: 0,
            max: Math.ceil(ultimateSettlementMm * 1.05),
        },
        series,
        caption:
            "Terzaghi one-dimensional theory. The S-curve is typical: most settlement happens in the middle of the time range.",
        aspect: 2.1,
    };
}

/* ------------------------------------------------------------------ *
 * Stress–strain
 * ------------------------------------------------------------------ */

/**
 * IS 456 concrete stress–strain curve: a parabola up to 0.002 strain, then a
 * constant plateau to the ultimate strain of 0.0035.
 */
export function concreteStressStrainCurve(
    fck: number,
    samples = 60,
): ChartPoint[] {
    const peak = 0.67 * fck;
    const strain0 = 0.002;
    const out: ChartPoint[] = [];
    for (let i = 0; i <= samples; i += 1) {
        const eps = (0.0035 * i) / samples;
        const ratio = eps / strain0;
        const stress =
            eps <= strain0
                ? peak * (2 * ratio - ratio * ratio)
                : peak * (2 - 1); // plateau: 2(1) - 1² = 1
        out.push({ x: eps * 100, y: stress });
    }
    return out;
}

/**
 * Idealised design stress–strain curve for reinforcement. Elastic up to the
 * design yield stress, then a constant plateau, which is the assumption IS 456
 * permits for strength calculations.
 */
export function steelStressStrainCurve(
    fy: number,
    es = 200000,
    maxStrain = 0.01,
    samples = 40,
): ChartPoint[] {
    const yieldStrain = fy / es;
    const out: ChartPoint[] = [
        { x: 0, y: 0 },
        { x: yieldStrain * 100, y: fy },
    ];
    const steps = Math.max(samples, 4);
    for (let i = 1; i <= steps; i += 1) {
        const eps = maxStrain * (i / steps);
        out.push({ x: eps * 100, y: fy });
    }
    return out.filter((p) => p.x <= maxStrain * 100 + 1e-9);
}

/* ------------------------------------------------------------------ *
 * Mix design
 * ------------------------------------------------------------------ */

/**
 * Free water-cement ratio against 28-day cube strength.
 *
 * A fit to the standard relationship in IS 10262 (cement-water ratio vs
 * compressive strength), in the familiar Abrams form f = A / B^w. The constants
 * below reproduce that curve closely for OPC 43 and are scaled for 33 and 53
 * grade cement. Indicative, not a substitute for trial mixes.
 */
export const MIX_CURVE_A = 195.7;
export const MIX_CURVE_B = 21.7;

export const CEMENT_GRADE_FACTOR: Record<number, number> = {
    33: 0.9,
    43: 1,
    53: 1.12,
};

export function strengthFromWcRatio(wc: number, cementGrade = 43): number {
    if (!(wc > 0)) return 0;
    const factor = CEMENT_GRADE_FACTOR[cementGrade] ?? 1;
    return (MIX_CURVE_A / MIX_CURVE_B ** wc) * factor;
}

/** Water-cement ratio that produces a given 28-day strength. */
export function wcRatioFromStrength(f28: number, cementGrade = 43): number {
    const factor = CEMENT_GRADE_FACTOR[cementGrade] ?? 1;
    const target = f28 / factor;
    if (!(target > 0)) return 0.7;
    // Invert f = A / B^w  ->  w = log_B(A / f)
    return Math.log(MIX_CURVE_A / target) / Math.log(MIX_CURVE_B);
}

/**
 * The mix design curve with the design point marked — the "mix design curve"
 * an engineer reads a water-cement ratio off.
 */
export function mixDesignChart(params: {
    cementGrade: number;
    targetStrength: number;
    designWc: number;
    maxWc: number;
}): ChartSpec {
    const curve: ChartPoint[] = [];
    const samples = 60;
    for (let i = 0; i <= samples; i += 1) {
        const wc = 0.3 + (0.45 * i) / samples;
        curve.push({ x: wc, y: strengthFromWcRatio(wc, params.cementGrade) });
    }

    const series: ChartSeries[] = [
        {
            name: `Expected 28-day strength — OPC ${params.cementGrade}`,
            tone: "primary",
            points: curve,
        },
        {
            name: "Target mean strength",
            tone: "muted",
            dashed: true,
            points: [
                { x: 0.3, y: params.targetStrength },
                { x: 0.75, y: params.targetStrength },
            ],
        },
        {
            name: "Durability cap (max w/c)",
            tone: "danger",
            dashed: true,
            points: [
                { x: params.maxWc, y: 0 },
                { x: params.maxWc, y: curve[curve.length - 1].y },
            ],
        },
        {
            name: "Adopted w/c",
            tone: "success",
            markers: true,
            points: [
                {
                    x: params.designWc,
                    y: strengthFromWcRatio(params.designWc, params.cementGrade),
                },
            ],
        },
    ];

    return {
        title: "Water-cement ratio against strength",
        x: {
            label: "Free water-cement ratio",
            min: 0.3,
            max: 0.75,
            ticks: [0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7, 0.75],
            format: (v) => v.toFixed(2),
        },
        y: { label: "28-day cube strength (MPa)", min: 0 },
        series,
        caption:
            "Curve fitted to the relationship in IS 10262. Read the ratio where the curve meets the target mean strength, then check it against the durability cap.",
        aspect: 2.1,
    };
}
