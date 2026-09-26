import { useMemo } from "react";
import {
    TONE_COLORS,
    describeChart,
    layoutChart,
    toAreaPolygon,
    toPolyline,
    type ChartSpec,
    type ChartTone,
} from "@/core/chart";

interface Props {
    spec: ChartSpec;
    /** Drawn width in user units; the SVG scales to the container. Default 660. */
    width?: number;
}

/**
 * A dependency-free line chart.
 *
 * The geometry comes from `layoutChart` in the core, so the same numbers drive
 * the on-screen chart and the vector chart written into an exported PDF.
 */
export default function Chart({ spec, width = 660 }: Props) {
    const aspect = spec.aspect && spec.aspect > 0 ? spec.aspect : 2;
    const height = Math.round(width / aspect);

    const layout = useMemo(
        () => layoutChart(spec, width, height),
        [spec, width, height],
    );

    if (layout.empty) {
        return (
            <div className="chart-empty">
                Nothing to plot for the current inputs.
            </div>
        );
    }

    const tone = (t: ChartTone | undefined) =>
        (TONE_COLORS[t ?? "primary"] ?? TONE_COLORS.primary).css;

    const grid = spec.grid !== false;

    return (
        <figure className="chart">
            <figcaption className="chart-title">{spec.title}</figcaption>

            <svg
                className="chart-svg"
                viewBox={`0 0 ${layout.width} ${layout.height}`}
                role="img"
                aria-label={describeChart(spec).replace(/\n/g, ". ")}
            >
                {/* Plot background */}
                <rect
                    className="chart-plot"
                    x={layout.plot.x}
                    y={layout.plot.y}
                    width={layout.plot.width}
                    height={layout.plot.height}
                />

                {grid &&
                    layout.yTicks.map((t) => (
                        <line
                            key={`gy-${t.value}`}
                            className="chart-grid"
                            x1={layout.plot.x}
                            x2={layout.plot.x + layout.plot.width}
                            y1={t.position}
                            y2={t.position}
                        />
                    ))}

                {/* Axes */}
                <line
                    className="chart-axis"
                    x1={layout.plot.x}
                    x2={layout.plot.x}
                    y1={layout.plot.y}
                    y2={layout.plot.y + layout.plot.height}
                />
                <line
                    className="chart-axis"
                    x1={layout.plot.x}
                    x2={layout.plot.x + layout.plot.width}
                    y1={layout.plot.y + layout.plot.height}
                    y2={layout.plot.y + layout.plot.height}
                />

                {/* Tick marks and labels */}
                {layout.xTicks.map((t) => (
                    <g key={`tx-${t.value}`}>
                        <line
                            className="chart-tick"
                            x1={t.position}
                            x2={t.position}
                            y1={layout.plot.y + layout.plot.height}
                            y2={layout.plot.y + layout.plot.height + 5}
                        />
                        <text
                            className="chart-tick-label"
                            x={t.position}
                            y={layout.plot.y + layout.plot.height + 18}
                            textAnchor="middle"
                        >
                            {t.label}
                        </text>
                    </g>
                ))}
                {layout.yTicks.map((t) => (
                    <g key={`ty-${t.value}`}>
                        <line
                            className="chart-tick"
                            x1={layout.plot.x - 5}
                            x2={layout.plot.x}
                            y1={t.position}
                            y2={t.position}
                        />
                        <text
                            className="chart-tick-label"
                            x={layout.plot.x - 9}
                            y={t.position + 4}
                            textAnchor="end"
                        >
                            {t.label}
                        </text>
                    </g>
                ))}

                {/* Series */}
                {layout.series.map((s, index) => {
                    const colour = tone(s.series.tone);
                    const baseline = layout.plot.y + layout.plot.height;
                    return (
                        <g key={`${s.series.name}-${index}`}>
                            {s.series.area && s.points.length > 1 && (
                                <polygon
                                    className="chart-area"
                                    points={toAreaPolygon(s.points, baseline)}
                                    style={{ fill: colour }}
                                />
                            )}
                            {s.points.length > 1 && (
                                <polyline
                                    className="chart-line"
                                    points={toPolyline(s.points)}
                                    style={{ stroke: colour }}
                                    strokeDasharray={
                                        s.series.dashed ? "6 4" : undefined
                                    }
                                />
                            )}
                            {s.series.markers &&
                                s.points.map((p, i) => (
                                    <circle
                                        key={i}
                                        className="chart-marker"
                                        cx={p.x}
                                        cy={p.y}
                                        r={3}
                                        style={{
                                            stroke: colour,
                                            fill: colour,
                                        }}
                                    />
                                ))}
                            {/* A single point still deserves to be visible. */}
                            {s.points.length === 1 && (
                                <circle
                                    className="chart-marker"
                                    cx={s.points[0].x}
                                    cy={s.points[0].y}
                                    r={3.5}
                                    style={{ stroke: colour, fill: colour }}
                                />
                            )}
                        </g>
                    );
                })}

                {/* Axis titles */}
                <text
                    className="chart-axis-title"
                    x={layout.plot.x + layout.plot.width / 2}
                    y={layout.height - 6}
                    textAnchor="middle"
                >
                    {layout.xTitle}
                </text>
                <text
                    className="chart-axis-title"
                    x={14}
                    y={layout.plot.y + layout.plot.height / 2}
                    textAnchor="middle"
                    transform={`rotate(-90 14 ${
                        layout.plot.y + layout.plot.height / 2
                    })`}
                >
                    {layout.yTitle}
                </text>
            </svg>

            <div className="chart-legend">
                {spec.series
                    .filter((s) => s.points.length > 0)
                    .map((s, i) => (
                        <span
                            className="chart-legend-item"
                            key={`${s.name}-${i}`}
                        >
                            <span
                                className="chart-swatch"
                                style={{
                                    background: `var(${tone(s.tone)})`,
                                    opacity: s.dashed ? 0.55 : 1,
                                }}
                            />
                            {s.name}
                        </span>
                    ))}
            </div>

            {spec.caption && <p className="chart-caption">{spec.caption}</p>}
        </figure>
    );
}
