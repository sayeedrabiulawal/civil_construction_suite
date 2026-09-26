import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import Field from "@/components/Field";
import { CATEGORY_BY_ID } from "@/core/categories";
import {
    describeInputs,
    heroRow,
    initialUnits,
    initialValues,
    runCalculator,
} from "@/core/engine";
import { outputUnit } from "@/core/format";
import { getCalculator } from "@/core/registry";
import type { Calculator } from "@/core/types";
import { addHistory, isFavorite, toggleFavorite } from "@/store/storage";
import { useStoreVersion } from "@/store/useStore";

/** How long to wait after the last keystroke before recording to history. */
const HISTORY_DEBOUNCE_MS = 1500;

interface Props {
    calc: Calculator;
}

export default function CalculatorScreen({ calc }: Props) {
    useStoreVersion();

    const [values, setValues] = useState(() => initialValues(calc));
    const [units, setUnits] = useState(() => initialUnits(calc));
    const [copied, setCopied] = useState(false);

    const category = CATEGORY_BY_ID[calc.category];
    const favorited = isFavorite(calc.id);

    const rows = useMemo(
        () => runCalculator(calc, values, units),
        [calc, values, units],
    );
    const hero = heroRow(rows);
    const rest = rows.filter((r) => r !== hero);

    // Record the calculation in history once the user stops typing.
    useEffect(() => {
        const timer = setTimeout(() => {
            if (!hero) return;
            const unit = outputUnit(hero.field);
            addHistory(
                calc,
                describeInputs(calc, values, units),
                `${hero.field.label}: ${hero.text}${unit ? ` ${unit}` : ""}`,
            );
        }, HISTORY_DEBOUNCE_MS);
        return () => clearTimeout(timer);
        // `hero` is derived from values/units, so listing those is sufficient.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [calc, values, units]);

    const copyResults = async () => {
        const lines = rows.map((r) => {
            const unit = outputUnit(r.field);
            return `${r.field.label}: ${r.text}${unit ? ` ${unit}` : ""}`;
        });
        const text = `${calc.name}\n\nInputs\n${describeInputs(calc, values, units)}\n\nResults\n${lines.join("\n")}`;
        try {
            await navigator.clipboard.writeText(text);
            setCopied(true);
            setTimeout(() => setCopied(false), 1800);
        } catch {
            setCopied(false);
        }
    };

    const reset = () => {
        setValues(initialValues(calc));
        setUnits(initialUnits(calc));
    };

    return (
        <>
            <div className="calc-header">
                <div className="calc-title">
                    <div className="crumbs">
                        <Link to="/">Home</Link>
                        {" / "}
                        <Link to={`/category/${calc.category}`}>
                            {category?.name ?? calc.category}
                        </Link>
                    </div>
                    <h1>{calc.name}</h1>
                </div>
                <button
                    type="button"
                    className={favorited ? "star on" : "star"}
                    aria-label={
                        favorited
                            ? "Remove from favourites"
                            : "Add to favourites"
                    }
                    onClick={() => toggleFavorite(calc.id)}
                >
                    {favorited ? "★" : "☆"}
                </button>
            </div>
            <p className="page-sub">{calc.summary}</p>

            <div className="calc-columns">
                <section className="panel">
                    <h2>Inputs</h2>
                    {calc.inputs.map((f) => (
                        <Field
                            key={f.key}
                            field={f}
                            value={values[f.key]}
                            unit={units[f.key] ?? ""}
                            onChange={(v) =>
                                setValues((prev) => ({ ...prev, [f.key]: v }))
                            }
                            onUnitChange={(u) =>
                                setUnits((prev) => ({ ...prev, [f.key]: u }))
                            }
                        />
                    ))}
                    <div className="calc-actions">
                        <button
                            type="button"
                            className="button"
                            onClick={reset}
                        >
                            Reset to defaults
                        </button>
                    </div>
                </section>

                <section className="panel">
                    <h2>Results</h2>
                    {hero && (
                        <div className="hero-result">
                            <div className="label">{hero.field.label}</div>
                            <div className="value">
                                {hero.text}
                                <span className="unit">
                                    {outputUnit(hero.field)}
                                </span>
                            </div>
                        </div>
                    )}

                    <div className="result-list">
                        {rest.map((r) => {
                            const unit = outputUnit(r.field);
                            return (
                                <div
                                    className={
                                        r.isText
                                            ? "result-row text"
                                            : "result-row"
                                    }
                                    key={r.field.key}
                                >
                                    <span className="rlabel">
                                        {r.field.label}
                                        {r.field.help && (
                                            <span className="hint">
                                                {r.field.help}
                                            </span>
                                        )}
                                    </span>
                                    <span className="rvalue">
                                        {r.text}
                                        {unit && !r.isText && (
                                            <span className="runit">
                                                {unit}
                                            </span>
                                        )}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="calc-actions">
                        <button
                            type="button"
                            className="button primary"
                            onClick={copyResults}
                        >
                            {copied ? "Copied ✓" : "Copy results"}
                        </button>
                        <Link
                            className="button"
                            to={`/category/${calc.category}`}
                        >
                            More {category?.name ?? "tools"}
                        </Link>
                    </div>
                </section>
            </div>

            <div className="meta">
                {calc.formula && (
                    <div className="meta-block">
                        <h4>Formula used</h4>
                        <pre className="formula">{calc.formula}</pre>
                    </div>
                )}

                {calc.reference && (
                    <div className="meta-block">
                        <h4>Reference</h4>
                        <p>{calc.reference}</p>
                    </div>
                )}

                {calc.notes && calc.notes.length > 0 && (
                    <div className="meta-block">
                        <h4>Notes and assumptions</h4>
                        <ul>
                            {calc.notes.map((n) => (
                                <li key={n}>{n}</li>
                            ))}
                        </ul>
                    </div>
                )}

                <div className="meta-block">
                    <h4>Engineering disclaimer</h4>
                    <p>
                        These tools are for preliminary estimation, checking and
                        learning. They do not replace a design by a qualified
                        engineer or the governing code for your project. Always
                        verify against the relevant standard and your own site
                        data.
                    </p>
                </div>
            </div>
        </>
    );
}

/** Resolves the calculator from the URL and remounts on navigation. */
export function CalculatorRoute() {
    const { id } = useParams();
    const calc = getCalculator(id);

    if (!calc) {
        return (
            <div className="empty">
                That calculator does not exist. <Link to="/">Go back home</Link>
                .
            </div>
        );
    }

    // The key forces fresh state when moving between two calculators.
    return <CalculatorScreen key={calc.id} calc={calc} />;
}
