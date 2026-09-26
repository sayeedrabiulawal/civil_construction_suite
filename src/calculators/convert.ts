import type { Calculator, Quantity } from "@/core/types";
import { UNIT_GROUPS } from "@/core/units";

/**
 * The unit converter category is generated from `UNIT_GROUPS`, not hand-written.
 *
 * Each converter is a real calculator. The single input arrives already in the SI
 * base unit, and every output is that value expressed in its own unit — one
 * distinct output key per unit so nothing collides.
 */
const CONVERTER_ORDER: { quantity: Exclude<Quantity, "none">; name: string }[] =
    [
        { quantity: "length", name: "Length Converter" },
        { quantity: "area", name: "Area Converter" },
        { quantity: "volume", name: "Volume Converter" },
        { quantity: "mass", name: "Weight / Mass Converter" },
        { quantity: "force", name: "Force Converter" },
        { quantity: "pressure", name: "Pressure & Stress Converter" },
        { quantity: "density", name: "Density Converter" },
        { quantity: "unitWeight", name: "Unit Weight Converter" },
        { quantity: "flow", name: "Flow Rate Converter" },
        { quantity: "velocity", name: "Velocity Converter" },
        { quantity: "time", name: "Time Converter" },
        { quantity: "angle", name: "Angle Converter" },
        { quantity: "temperature", name: "Temperature Converter" },
    ];

/** Significant digits tuned to each magnitude class so results stay readable. */
function decimalsFor(magnitude: number): number {
    const a = Math.abs(magnitude);
    if (a === 0) return 2;
    if (a >= 1000) return 2;
    if (a >= 1) return 4;
    if (a >= 0.001) return 6;
    return 9;
}

function makeConverter(
    quantity: Exclude<Quantity, "none">,
    name: string,
): Calculator {
    const units = UNIT_GROUPS[quantity];
    const base = units[0];

    return {
        id: `convert-${quantity.toLowerCase()}`,
        name,
        category: "convert",
        tags: ["convert", "conversion", "unit", quantity, "calculator"],
        summary: `Convert between ${units.map((u) => u.label).join(", ")}.`,
        formula:
            "Value in target unit = base value × target unit conversion factor",
        inputs: [
            {
                key: "value",
                label: `Value in ${base.label}`,
                quantity,
                defaultUnit: base.id,
                default: 1,
            },
        ],
        outputs: units.map((u) => ({
            key: `out_${u.id}`,
            label: u.label,
            unit: u.label,
            decimals: decimalsFor(u.fromBase(1)),
            hero: u.id === base.id,
        })),
        compute: (v) => {
            const out: Record<string, number> = {};
            for (const u of units) out[`out_${u.id}`] = u.fromBase(v.value);
            return out;
        },
    };
}

export const CONVERT_CALCULATORS: Calculator[] = CONVERTER_ORDER.map((c) =>
    makeConverter(c.quantity, c.name),
);
