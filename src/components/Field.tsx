import type { InputField } from "@/core/types";
import { unitsFor } from "@/core/units";

interface Props {
    field: InputField;
    value: number | boolean;
    unit: string;
    onChange: (value: number | boolean) => void;
    onUnitChange: (unit: string) => void;
}

/**
 * Renders one calculator input. Every calculator on the site goes through this
 * component, so a new calculator never needs new UI code.
 */
export default function Field({
    field,
    value,
    unit,
    onChange,
    onUnitChange,
}: Props) {
    const unitList = unitsFor(field);
    const staticUnit = unitList.length === 0 ? (field.unit ?? "") : "";

    if (field.kind === "bool") {
        return (
            <div className="field">
                <label className="checkbox-row">
                    <input
                        type="checkbox"
                        checked={Boolean(value)}
                        onChange={(e) => onChange(e.target.checked)}
                    />
                    <span>
                        {field.label}
                        {field.help && (
                            <span className="hint">{field.help}</span>
                        )}
                    </span>
                </label>
            </div>
        );
    }

    if (field.kind === "select") {
        return (
            <div className="field">
                <label htmlFor={field.key}>{field.label}</label>
                <div className="control">
                    <select
                        id={field.key}
                        value={Number(value)}
                        onChange={(e) => onChange(Number(e.target.value))}
                    >
                        {field.options?.map((o) => (
                            <option key={o.value} value={o.value}>
                                {o.label}
                            </option>
                        ))}
                    </select>
                </div>
                {field.help && <span className="hint">{field.help}</span>}
            </div>
        );
    }

    return (
        <div className="field">
            <label htmlFor={field.key}>
                {field.label}
                {field.help && <span className="hint">{field.help}</span>}
            </label>
            <div className="control">
                <input
                    id={field.key}
                    type="number"
                    inputMode="decimal"
                    value={Number(value)}
                    min={field.min}
                    max={field.max}
                    step={field.step ?? "any"}
                    onChange={(e) => {
                        const next =
                            e.target.value === "" ? 0 : Number(e.target.value);
                        onChange(Number.isFinite(next) ? next : 0);
                    }}
                />
                {unitList.length > 0 && (
                    <select
                        className="unit-select"
                        aria-label={`Unit for ${field.label}`}
                        value={unit}
                        onChange={(e) => onUnitChange(e.target.value)}
                    >
                        {unitList.map((u) => (
                            <option key={u.id} value={u.id}>
                                {u.label}
                            </option>
                        ))}
                    </select>
                )}
                {staticUnit && <span className="unit-badge">{staticUnit}</span>}
            </div>
        </div>
    );
}
