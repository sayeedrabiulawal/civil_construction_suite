/**
 * Chart geometry.
 *
 * Deliberately free of React and of the DOM: `layoutChart` turns a
 * {@link ChartSpec} into pixel coordinates, which the on-screen SVG component
 * and the PDF writer both consume. That way a chart looks the same on the page
 * and in the exported report, and the maths is testable on its own.
 */

export type ChartScale = "linear" | "log";

/** Colour role, resolved to a CSS variable on screen and an RGB triple in PDF. */
export type ChartTone = "primary" | "accent" | "muted" | "danger" | "success";

/**
 * Palette shared by the SVG component and the PDF writer, so a series keeps its
 * colour when it moves from the screen into an exported report.
 * `css` names a custom property declared in `styles.css` (light and dark).
 */
export const TONE_COLORS: Record<
    ChartTone,
    { css: string; rgb: [number, number, number] }
> = {
    primary: { css: "--chart-1", rgb: [29, 78, 216] },
    accent: { css: "--chart-2", rgb: [15, 118, 110] },
    success: { css: "--chart-3", rgb: [180, 83, 9] },
    danger: { css: "--chart-4", rgb: [185, 28, 28] },
    muted: { css: "--chart-5", rgb: [100, 116, 139] },
};

export interface ChartPoint {
    x: number;
    y: number;
}

export interface ChartSeries {
    name: string;
    points: ChartPoint[];
    tone?: ChartTone;
    /** Dashed lines read as limits or envelopes rather than measured data. */
    dashed?: boolean;
    /** Draw a dot at every point. */
    markers?: boolean;
    /** Fill between this series and the x-axis (used for the area under a curve). */
    area?: boolean;
}

export interface ChartAxis {
    label: string;
    scale?: ChartScale;
    /** Force the axis range, overriding what the data implies. */
    min?: number;
    max?: number;
    /** Explicit tick values, e.g. the standard sieve sizes. */
    ticks?: number[];
    /** Override tick label formatting. */
    format?: (value: number) => string;
}

export interface ChartSpec {
    title: string;
    x: ChartAxis;
    y: ChartAxis;
    series: ChartSeries[];
    /** One-line note printed under the plot, e.g. the source of the limits. */
    caption?: string;
    /** Horizontal gridlines. Default true. */
    grid?: boolean;
    /** Aspect ratio numerator, used by the SVG component. Default 2 (2:1). */
    aspect?: number;
}

export interface ChartPadding {
    left: number;
    right: number;
    top: number;
    bottom: number;
}

export const DEFAULT_PADDING: ChartPadding = {
    left: 62,
    right: 20,
    top: 16,
    bottom: 44,
};

export interface ChartTick {
    value: number;
    label: string;
    /** Pixel position along the axis. */
    position: number;
}

export interface LaidOutSeries {
    series: ChartSeries;
    /** Series points in pixels: plot origin is top-left. */
    points: ChartPoint[];
}

export interface ChartLayout {
    width: number;
    height: number;
    /** Plot rectangle in pixels. */
    plot: { x: number; y: number; width: number; height: number };
    xTicks: ChartTick[];
    yTicks: ChartTick[];
    series: LaidOutSeries[];
    xTitle: string;
    yTitle: string;
    /** True when there is nothing plottable, so the UI can say so. */
    empty: boolean;
}

/* ------------------------------------------------------------------ *
 * Tick generation
 * ------------------------------------------------------------------ */

/**
 * "Nice" round ticks — 1, 2, 5, 10, 20, 50… rather than 0.37, 1.11, 1.85.
 * These read as an engineering graph instead of a debug plot.
 */
export function niceTicks(min: number, max: number, count = 5): number[] {
    if (!Number.isFinite(min) || !Number.isFinite(max)) return [0, 1];

    let lo = Math.min(min, max);
    let hi = Math.max(min, max);

    if (hi === lo) {
        const pad = Math.abs(lo) > 1e-9 ? Math.abs(lo) * 0.1 : 1;
        lo -= pad;
        hi += pad;
    }

    const rawStep = (hi - lo) / Math.max(1, Math.round(count));
    const magnitude = 10 ** Math.floor(Math.log10(rawStep));
    const normalised = rawStep / magnitude;
    const step =
        magnitude *
        (normalised <= 1 ? 1 : normalised <= 2 ? 2 : normalised <= 5 ? 5 : 10);

    const first = Math.ceil(lo / step) * step;
    const out: number[] = [];

    // The iteration guard protects against floating point drift on tiny steps.
    for (let v = first, i = 0; v <= hi + step * 1e-6 && i < 400; i += 1) {
        // Snap values that are within rounding noise of zero to exactly zero.
        out.push(Math.abs(v) < step * 1e-9 ? 0 : Number(v.toPrecision(12)));
        v += step;
    }

    return out.length >= 2 ? out : [lo, hi];
}

/**
 * Log-scale ticks. Over one or two decades the intermediate 2…9 multipliers
 * are worth showing; over a wider range only the powers of ten stay readable.
 */
export function logTicks(min: number, max: number): number[] {
    if (!(min > 0) || !(max > min) || !Number.isFinite(min + max))
        return [1, 10];

    const startExp = Math.floor(Math.log10(min));
    const endExp = Math.ceil(Math.log10(max));
    const decades = endExp - startExp;
    const multipliers = decades <= 2 ? [1, 2, 3, 4, 5, 6, 7, 8, 9] : [1];
    const out: number[] = [];

    for (let e = startExp; e <= endExp; e += 1) {
        for (const m of multipliers) {
            const v = m * 10 ** e;
            if (v >= min * 0.999 && v <= max * 1.001)
                out.push(Number(v.toPrecision(12)));
        }
    }

    return out.length >= 2 ? out : [min, max];
}

/** Tick label: short enough to fit, but never exponent soup for normal values. */
export function formatTick(value: number): string {
    if (!Number.isFinite(value)) return "";
    const abs = Math.abs(value);
    if (abs === 0) return "0";
    if (abs >= 1e9) return `${trim(value / 1e9)}B`;
    if (abs >= 1e6) return `${trim(value / 1e6)}M`;
    if (abs >= 1e4) return `${trim(value / 1e3)}k`;
    return trim(value);
}

function trim(value: number, significant = 4): string {
    const rounded = Number(value.toPrecision(significant));
    if (Object.is(rounded, -0)) return "0";
    const abs = Math.abs(rounded);
    if (abs >= 1e-4 && abs < 1e7) return String(rounded);
    return rounded.toExponential(1);
}

/* ------------------------------------------------------------------ *
 * Layout
 * ------------------------------------------------------------------ */

interface ResolvedAxis {
    min: number;
    max: number;
    ticks: number[];
    scale: ChartScale;
}

function resolveAxis(
    axis: ChartAxis,
    values: number[],
    fallback: [number, number],
): ResolvedAxis {
    const scale: ChartScale = axis.scale ?? "linear";
    const clean = values.filter((v) => Number.isFinite(v));
    const usable = scale === "log" ? clean.filter((v) => v > 0) : clean.slice();

    let lo = axis.min ?? (usable.length ? Math.min(...usable) : fallback[0]);
    let hi = axis.max ?? (usable.length ? Math.max(...usable) : fallback[1]);

    if (scale === "log") {
        // A log axis cannot start at or below zero.
        if (!(lo > 0)) lo = hi > 0 ? hi / 10 : 1;
        if (!(hi > lo)) hi = lo * 10;
    } else if (hi <= lo) {
        const pad = Math.abs(lo) > 1e-9 ? Math.abs(lo) * 0.5 : 1;
        lo -= pad;
        hi += pad;
    }

    if (axis.ticks && axis.ticks.length >= 2) {
        const sorted = [...axis.ticks].sort((a, b) => a - b);
        return {
            scale,
            ticks: sorted,
            min: axis.min ?? sorted[0],
            max: axis.max ?? sorted[sorted.length - 1],
        };
    }

    const ticks = scale === "log" ? logTicks(lo, hi) : niceTicks(lo, hi, 5);

    // Snap the domain outwards to the outermost tick so the plot fills the box.
    return {
        scale,
        ticks,
        min: axis.min ?? Math.min(lo, ticks[0]),
        max: axis.max ?? Math.max(hi, ticks[ticks.length - 1]),
    };
}

/** Map a data value into a 0…1 fraction across the axis. */
export function axisFraction(
    value: number,
    min: number,
    max: number,
    scale: ChartScale,
): number {
    if (scale === "log") {
        const lv = Math.log10(Math.max(value, Number.MIN_VALUE));
        const a = Math.log10(Math.max(min, Number.MIN_VALUE));
        const b = Math.log10(Math.max(max, Number.MIN_VALUE));
        if (!Number.isFinite(lv) || b === a) return 0;
        return (lv - a) / (b - a);
    }
    return max === min ? 0 : (value - min) / (max - min);
}

/**
 * Turn a spec into pixels. `width`/`height` are in the same units the renderer
 * draws in (SVG user units, or PDF points).
 */
export function layoutChart(
    spec: ChartSpec,
    width = 640,
    height = 320,
    padding: Partial<ChartPadding> = {},
): ChartLayout {
    const pad: ChartPadding = { ...DEFAULT_PADDING, ...padding };

    const plot = {
        x: pad.left,
        y: pad.top,
        width: Math.max(width - pad.left - pad.right, 1),
        height: Math.max(height - pad.top - pad.bottom, 1),
    };

    const xs: number[] = [];
    const ys: number[] = [];
    for (const s of spec.series)
        for (const p of s.points) {
            xs.push(p.x);
            ys.push(p.y);
        }

    const xAxis = resolveAxis(spec.x, xs, [0, 1]);
    const yAxis = resolveAxis(spec.y, ys, [0, 1]);

    const fmt = (axis: ChartAxis, v: number) =>
        axis.format ? axis.format(v) : formatTick(v);

    const xTicks: ChartTick[] = xAxis.ticks.map((value) => ({
        value,
        label: fmt(spec.x, value),
        position:
            plot.x +
            axisFraction(value, xAxis.min, xAxis.max, xAxis.scale) * plot.width,
    }));

    const yTicks: ChartTick[] = yAxis.ticks.map((value) => ({
        value,
        label: fmt(spec.y, value),
        position:
            plot.y +
            plot.height -
            axisFraction(value, yAxis.min, yAxis.max, yAxis.scale) *
                plot.height,
    }));

    const series: LaidOutSeries[] = spec.series.map((s) => ({
        series: s,
        points: s.points
            .filter((p) =>
                xAxis.scale === "log"
                    ? p.x > 0 && Number.isFinite(p.x) && Number.isFinite(p.y)
                    : Number.isFinite(p.x) && Number.isFinite(p.y),
            )
            .map((p) => ({
                x:
                    plot.x +
                    axisFraction(p.x, xAxis.min, xAxis.max, xAxis.scale) *
                        plot.width,
                y:
                    plot.y +
                    plot.height -
                    axisFraction(p.y, yAxis.min, yAxis.max, yAxis.scale) *
                        plot.height,
            })),
    }));

    const empty = series.every((s) => s.points.length === 0);

    return {
        width,
        height,
        plot,
        xTicks,
        yTicks,
        series,
        xTitle: spec.x.label,
        yTitle: spec.y.label,
        empty,
    };
}

/** "x1, y1 x2, y2 …" polyline points, used by both SVG and the PDF writer. */
export function toPolyline(points: ChartPoint[]): string {
    return points.map((p) => `${round(p.x)},${round(p.y)}`).join(" ");
}

/** A closed polygon that drops to the x-axis, for area fills. */
export function toAreaPolygon(points: ChartPoint[], baseline: number): string {
    if (points.length === 0) return "";
    const first = points[0];
    const last = points[points.length - 1];
    const corners = [
        `${round(first.x)},${round(baseline)}`,
        ...points.map((p) => `${round(p.x)},${round(p.y)}`),
        `${round(last.x)},${round(baseline)}`,
    ];
    return corners.join(" ");
}

function round(v: number): number {
    return Math.round(v * 100) / 100;
}

/**
 * Plain-text rendering of a chart, for the clipboard, the accessible
 * description and anywhere an image cannot go.
 */
export function describeChart(spec: ChartSpec): string {
    const parts = [`${spec.title} (${spec.x.label} vs ${spec.y.label})`];
    for (const s of spec.series) {
        if (s.points.length === 0) continue;
        const ys = s.points.map((p) => p.y);
        parts.push(
            `${s.name}: ${s.points.length} points, ${formatTick(
                Math.min(...ys),
            )} to ${formatTick(Math.max(...ys))}`,
        );
    }
    return parts.join("\n");
}
