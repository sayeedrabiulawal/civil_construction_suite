import type { Calculator, SelectOption } from "@/core/types";
import {
    barArea,
    barUnitWeight,
    bondStress,
    bondStressMultiplier,
} from "./shared";

/**
 * IMPORTANT: inputs arrive here in SI base units — lengths in METRES, areas in m².
 * Bar diameters and bar spacings are only meaningful in millimetres, so every
 * `compute` below converts at the top and then stays in millimetres throughout.
 */
const MM = 1000;

const CONCRETE_GRADES = ["M20", "M25", "M30", "M35", "M40", "M45", "M50"];
const GRADE_OPTIONS: SelectOption[] = CONCRETE_GRADES.map((g, i) => ({
    value: i,
    label: g,
}));

const STEEL_GRADES = [
    { value: 0, label: "Fe250 (mild steel)", fy: 250 },
    { value: 1, label: "Fe415 (HYSD)", fy: 415 },
    { value: 2, label: "Fe500 (HYSD)", fy: 500 },
    { value: 3, label: "Fe550 (HYSD)", fy: 550 },
];

const STEEL_OPTIONS: SelectOption[] = STEEL_GRADES.map((s) => ({
    value: s.value,
    label: s.label,
}));

const BAR_TYPES: SelectOption[] = [
    { value: 0, label: "Plain bar" },
    { value: 1, label: "Deformed bar (HYSD / TMT)" },
];

const CONDITIONS: SelectOption[] = [
    { value: 0, label: "Tension (flexural member)" },
    { value: 1, label: "Tension (direct)" },
    { value: 2, label: "Compression" },
];

/** Ld = φ × 0.87 fy ÷ (4 τbd) — IS 456:2000 Cl. 26.2.1.1. Diameter in mm, result in mm. */
function developmentLength(
    diaMm: number,
    gradeIndex: number,
    fy: number,
    barType: number,
    condition: number,
): number {
    const tbd =
        bondStress(gradeIndex) * bondStressMultiplier(barType, condition);
    return (diaMm * 0.87 * fy) / (4 * tbd);
}

export const STEEL_CALCULATORS: Calculator[] = [
    {
        id: "steel-bar-weight",
        name: "Steel Bar Weight (D²/162)",
        category: "steel",
        tags: [
            "steel",
            "bar",
            "weight",
            "rebar",
            "tmt",
            "d2/162",
            "unit weight",
            "kg per metre",
        ],
        summary:
            "Unit weight and total weight of reinforcement bars of any diameter.",
        formula:
            "Unit weight (kg/m) = d² ÷ 162\nTotal weight = Unit weight × Total length",
        reference:
            "Derived from the density of steel (7850 kg/m³). Exact factor: d² × 0.006165.",
        inputs: [
            {
                key: "dia",
                label: "Bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 12,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "barLength",
                label: "Length of one bar",
                quantity: "length",
                defaultUnit: "m",
                default: 12,
                min: 0,
            },
            { key: "count", label: "Number of bars", default: 10, min: 0 },
        ],
        outputs: [
            {
                key: "totalWeight",
                label: "Total steel weight",
                unit: "kg",
                decimals: 2,
                hero: true,
            },
            {
                key: "unitWeight",
                label: "Unit weight",
                unit: "kg/m",
                decimals: 4,
            },
            {
                key: "totalLength",
                label: "Total length",
                unit: "m",
                decimals: 2,
            },
            { key: "tonne", label: "Total weight", unit: "tonne", decimals: 4 },
            {
                key: "area",
                label: "Cross-section area",
                unit: "mm²",
                decimals: 1,
            },
        ],
        notes: [
            "Common bar diameters: 8, 10, 12, 16, 20, 25, 32 and 40 mm.",
            "Works for any cut length, not just the standard 12 m stock bar.",
        ],
        compute: (v) => {
            const diaMm = v.dia * MM;
            const unitWeight = barUnitWeight(diaMm); // kg per metre
            const totalLength = v.barLength * v.count; // m
            const totalWeight = unitWeight * totalLength; // kg
            return {
                unitWeight,
                totalLength,
                totalWeight,
                tonne: totalWeight / 1000,
                area: barArea(diaMm),
            };
        },
    },

    {
        id: "development-length",
        name: "Development Length (Ld)",
        category: "steel",
        tags: ["development length", "ld", "anchorage", "bond", "is 456"],
        summary:
            "Anchorage length required to develop the full design stress in a bar.",
        formula:
            "Ld = (φ × 0.87 fy) ÷ (4 × τbd)\nτbd = grade value × 1.6 (deformed, tension) or × 1.25 (compression)",
        reference:
            "IS 456:2000 Cl. 26.2.1.1. For M20 with Fe415 deformed bars this gives ≈ 47φ.",
        inputs: [
            {
                key: "dia",
                label: "Bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 16,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "grade",
                label: "Concrete grade",
                kind: "select",
                default: 0,
                options: GRADE_OPTIONS,
            },
            {
                key: "steel",
                label: "Steel grade",
                kind: "select",
                default: 1,
                options: STEEL_OPTIONS,
            },
            {
                key: "barType",
                label: "Bar type",
                kind: "select",
                default: 1,
                options: BAR_TYPES,
            },
            {
                key: "condition",
                label: "Stress condition",
                kind: "select",
                default: 0,
                options: CONDITIONS,
            },
        ],
        outputs: [
            {
                key: "ld",
                label: "Development length",
                unit: "mm",
                decimals: 0,
                hero: true,
            },
            { key: "ldM", label: "Development length", unit: "m", decimals: 3 },
            {
                key: "multiple",
                label: "As a multiple of bar diameter",
                decimals: 1,
                help: "e.g. 47 means 47φ",
            },
        ],
        notes: [
            "The basic value is increased by 60% for deformed bars in tension and 25% in compression.",
            "Ld must never be less than 30φ for flexural tension.",
        ],
        compute: (v) => {
            const diaMm = v.dia * MM;
            const fy = STEEL_GRADES[v.steel].fy;
            const ld = developmentLength(
                diaMm,
                v.grade,
                fy,
                v.barType,
                v.condition,
            );
            return {
                ld,
                ldM: ld / MM,
                multiple: diaMm > 0 ? ld / diaMm : 0,
            };
        },
    },

    {
        id: "lap-length",
        name: "Lap Length Calculator",
        category: "steel",
        tags: ["lap", "lap length", "splice", "overlap", "rebar"],
        summary: "Required overlap when bars must be spliced together.",
        formula:
            "Flexural tension: lap = Ld (min 30φ)\nDirect tension: lap = 2 × Ld\nCompression: lap = Ld (min 24φ)",
        reference:
            "IS 456:2000 Cl. 26.2.5. Laps are best avoided in zones of maximum stress.",
        inputs: [
            {
                key: "dia",
                label: "Bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 16,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "grade",
                label: "Concrete grade",
                kind: "select",
                default: 0,
                options: GRADE_OPTIONS,
            },
            {
                key: "steel",
                label: "Steel grade",
                kind: "select",
                default: 1,
                options: STEEL_OPTIONS,
            },
            {
                key: "barType",
                label: "Bar type",
                kind: "select",
                default: 1,
                options: BAR_TYPES,
            },
            {
                key: "stress",
                label: "Stress condition",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "Flexural tension" },
                    { value: 1, label: "Direct tension" },
                    { value: 2, label: "Compression" },
                ],
            },
            {
                key: "bars",
                label: "Number of bars to be lapped",
                default: 1,
                min: 1,
            },
        ],
        outputs: [
            {
                key: "lap",
                label: "Lap length",
                unit: "mm",
                decimals: 0,
                hero: true,
            },
            { key: "lapM", label: "Lap length", unit: "m", decimals: 3 },
            {
                key: "ld",
                label: "Development length used",
                unit: "mm",
                decimals: 0,
            },
            {
                key: "multiple",
                label: "As a multiple of bar diameter",
                decimals: 1,
            },
            {
                key: "totalExtra",
                label: "Extra steel for laps",
                unit: "m",
                decimals: 2,
            },
        ],
        notes: [
            "When bars of different diameters are lapped, use the larger diameter for the lap.",
            "Stagger laps — do not lap more than 50% of bars at the same section.",
        ],
        compute: (v) => {
            const diaMm = v.dia * MM;
            const fy = STEEL_GRADES[v.steel].fy;
            const bondCondition = v.stress === 2 ? 2 : 0;
            const ld = developmentLength(
                diaMm,
                v.grade,
                fy,
                v.barType,
                bondCondition,
            );

            let lap: number;
            if (v.stress === 0) lap = Math.max(ld, 30 * diaMm);
            else if (v.stress === 1) lap = Math.max(2 * ld, 30 * diaMm);
            else lap = Math.max(ld, 24 * diaMm);

            return {
                lap,
                lapM: lap / MM,
                ld,
                multiple: diaMm > 0 ? lap / diaMm : 0,
                totalExtra: (lap * v.bars) / MM,
            };
        },
    },

    {
        id: "stirrup-cutting-length",
        name: "Stirrup / Tie Cutting Length",
        category: "steel",
        tags: [
            "stirrup",
            "tie",
            "ring",
            "cutting length",
            "bbs",
            "links",
            "hooks",
        ],
        summary:
            "Cutting length and weight of rectangular stirrups or ties for a beam or column.",
        formula:
            "a = width − 2 × cover,  b = depth − 2 × cover\nCutting length = 2(a + b) + 2 × hook × d − bends × deduction × d",
        reference:
            "Set the bend deduction to 0 to get the familiar 2(a + b) + 20d.",
        inputs: [
            {
                key: "width",
                label: "Beam / column width",
                quantity: "length",
                defaultUnit: "mm",
                default: 300,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "depth",
                label: "Beam / column depth",
                quantity: "length",
                defaultUnit: "mm",
                default: 450,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "cover",
                label: "Clear cover",
                quantity: "length",
                defaultUnit: "mm",
                default: 25,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "dia",
                label: "Stirrup bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 8,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "spacing",
                label: "Stirrup spacing",
                quantity: "length",
                defaultUnit: "mm",
                default: 150,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "memberLength",
                label: "Length of the member",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "hookFactor",
                label: "Hook allowance (× d)",
                default: 10,
                min: 0,
                max: 20,
                help: "10d per hook for a 135° hook. Two hooks.",
            },
            {
                key: "bends",
                label: "Number of 90° bends",
                default: 4,
                min: 0,
                max: 12,
                step: 1,
            },
            {
                key: "bendDeduction",
                label: "Bend deduction (× d each)",
                default: 2,
                min: 0,
                max: 5,
                step: 0.5,
            },
        ],
        outputs: [
            {
                key: "cuttingLength",
                label: "Cutting length per stirrup",
                unit: "mm",
                decimals: 0,
                hero: true,
            },
            { key: "count", label: "Number of stirrups", decimals: 0 },
            {
                key: "totalLength",
                label: "Total stirrup length",
                unit: "m",
                decimals: 2,
            },
            {
                key: "totalWeight",
                label: "Total stirrup weight",
                unit: "kg",
                decimals: 2,
            },
            { key: "a", label: "Stirrup dimension a", unit: "mm", decimals: 0 },
            { key: "b", label: "Stirrup dimension b", unit: "mm", decimals: 0 },
        ],
        notes: [
            "Bend deductions vary by site convention — check the project bar bending schedule.",
            "Stirrups are counted as member length ÷ spacing, rounded up, plus one.",
        ],
        compute: (v) => {
            const widthMm = v.width * MM;
            const depthMm = v.depth * MM;
            const coverMm = v.cover * MM;
            const diaMm = v.dia * MM;
            const spacingMm = v.spacing * MM;
            const memberMm = v.memberLength * MM;

            const a = Math.max(widthMm - 2 * coverMm, 0);
            const b = Math.max(depthMm - 2 * coverMm, 0);

            const cuttingLength =
                2 * (a + b) +
                2 * v.hookFactor * diaMm -
                v.bends * v.bendDeduction * diaMm;

            const count =
                spacingMm > 0 ? Math.floor(memberMm / spacingMm) + 1 : 0;
            const totalLength = (cuttingLength * count) / MM; // m

            return {
                cuttingLength,
                count,
                totalLength,
                totalWeight: totalLength * barUnitWeight(diaMm),
                a,
                b,
            };
        },
    },

    {
        id: "slab-steel-percentage",
        name: "Slab Steel from Percentage",
        category: "steel",
        tags: [
            "slab",
            "steel",
            "percentage",
            "ast",
            "reinforcement",
            "spacing",
        ],
        summary:
            "Steel area, number of bars, spacing and weight for a slab from a steel percentage.",
        formula:
            "Ast per metre = (p ÷ 100) × 1000 × d\nNumber of bars = Total Ast ÷ Area of one bar\nSpacing = Width ÷ Number of bars",
        reference:
            "IS 456:2000 Cl. 26.5.2.1 — minimum tension steel in slabs is 0.12% of the gross area.",
        inputs: [
            {
                key: "length",
                label: "Slab length (bar direction)",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "width",
                label: "Slab width (spacing direction)",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
            {
                key: "depth",
                label: "Effective depth d",
                quantity: "length",
                defaultUnit: "mm",
                default: 120,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "percentage",
                label: "Steel percentage",
                default: 0.3,
                min: 0.12,
                max: 2,
                step: 0.01,
                help: "% of gross cross-section. 0.12% is the Code minimum.",
            },
            {
                key: "dia",
                label: "Bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 10,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
        ],
        outputs: [
            {
                key: "ast",
                label: "Ast required",
                unit: "mm²",
                decimals: 0,
                hero: true,
                help: "Total steel area across the slab width",
            },
            {
                key: "astPerM",
                label: "Ast per metre width",
                unit: "mm²/m",
                decimals: 0,
            },
            { key: "bars", label: "Number of bars", decimals: 0 },
            {
                key: "spacing",
                label: "Centre-to-centre spacing",
                unit: "mm",
                decimals: 0,
            },
            { key: "weight", label: "Steel weight", unit: "kg", decimals: 2 },
            {
                key: "oneBarArea",
                label: "Area of one bar",
                unit: "mm²",
                decimals: 1,
            },
        ],
        notes: [
            "Round the spacing DOWN to a practical value (75, 100, 125, 150, 175, 200 mm) and keep it within the Code maximum.",
            "Provide distribution steel at a minimum of 0.12% of the gross area in the other direction.",
        ],
        compute: (v) => {
            const widthMm = v.width * MM;
            const depthMm = v.depth * MM;
            const diaMm = v.dia * MM;

            const ast = (v.percentage / 100) * widthMm * depthMm; // mm²
            const astPerM = (v.percentage / 100) * 1000 * depthMm; // mm² per metre
            const oneBarArea = barArea(diaMm);
            const bars = oneBarArea > 0 ? ast / oneBarArea : 0;
            const spacing = bars > 0 ? widthMm / bars : 0;
            const weight = bars * v.length * barUnitWeight(diaMm); // kg

            return { ast, astPerM, bars, spacing, weight, oneBarArea };
        },
    },

    {
        id: "bar-spacing",
        name: "Bar Spacing From Steel Area",
        category: "steel",
        tags: ["spacing", "pitch", "bars", "ast", "reinforcement", "detailing"],
        summary:
            "Centre-to-centre spacing of bars for a required steel area per metre.",
        formula: "Spacing = (1000 × Area of one bar) ÷ Ast per metre",
        reference:
            "IS 456:2000 Cl. 26.3.3 — maximum spacing limits apply for slabs and beams.",
        inputs: [
            {
                key: "ast",
                label: "Ast required per metre width",
                unit: "mm²/m",
                default: 400,
                min: 0,
                help: "Enter in mm² per metre",
            },
            {
                key: "dia",
                label: "Bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 12,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "width",
                label: "Member width available",
                quantity: "length",
                defaultUnit: "m",
                default: 1,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "spacing",
                label: "Required spacing",
                unit: "mm",
                decimals: 1,
                hero: true,
            },
            {
                key: "practicalSpacing",
                label: "Round down to (nearest 25 mm)",
                unit: "mm",
                decimals: 0,
            },
            {
                key: "barCount",
                label: "Number of bars across the member",
                decimals: 0,
            },
            {
                key: "oneBarArea",
                label: "Area of one bar",
                unit: "mm²",
                decimals: 1,
            },
            {
                key: "providedAst",
                label: "Ast provided at the rounded spacing",
                unit: "mm²/m",
                decimals: 0,
            },
        ],
        notes: [
            "Always choose a spacing smaller than the calculated value so the steel area is not reduced.",
            "Typical Code maxima: 3d or 300 mm for slabs, and the lesser of 0.75d or 300 mm for beam stirrups.",
        ],
        compute: (v) => {
            const diaMm = v.dia * MM;
            const oneBarArea = barArea(diaMm);
            const spacing = v.ast > 0 ? (1000 * oneBarArea) / v.ast : 0;
            const practical = Math.floor(spacing / 25) * 25;
            const providedAst =
                practical > 0 ? (1000 * oneBarArea) / practical : 0;
            const barCount =
                practical > 0 ? Math.floor((v.width * MM) / practical) + 1 : 0;
            return {
                spacing,
                practicalSpacing: practical,
                barCount,
                oneBarArea,
                providedAst,
            };
        },
    },
    {
        id: "bbs-weight-summary",
        name: "Bar Bending Schedule Summary",
        category: "steel",
        tags: [
            "bbs",
            "bar bending schedule",
            "summary",
            "steel quantity",
            "tonnage",
            "schedule",
        ],
        summary:
            "Total steel weight for up to five bar marks, as a bar bending schedule summary.",
        formula:
            "Weight per mark = (d² ÷ 162) × cutting length × number of bars\nGrand total = Σ every mark",
        reference:
            "Standard bar bending schedule practice, using the d²/162 unit weight rule.",
        inputs: [
            {
                key: "dia1",
                label: "Mark 1 — bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 16,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "len1",
                label: "Mark 1 — cutting length",
                quantity: "length",
                defaultUnit: "m",
                default: 4.2,
                min: 0,
            },
            {
                key: "n1",
                label: "Mark 1 — number of bars",
                default: 40,
                min: 0,
            },
            {
                key: "dia2",
                label: "Mark 2 — bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 12,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "len2",
                label: "Mark 2 — cutting length",
                quantity: "length",
                defaultUnit: "m",
                default: 3.5,
                min: 0,
            },
            {
                key: "n2",
                label: "Mark 2 — number of bars",
                default: 60,
                min: 0,
            },
            {
                key: "dia3",
                label: "Mark 3 — bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 8,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "len3",
                label: "Mark 3 — cutting length",
                quantity: "length",
                defaultUnit: "m",
                default: 1.3,
                min: 0,
            },
            {
                key: "n3",
                label: "Mark 3 — number of bars",
                default: 200,
                min: 0,
            },
            {
                key: "dia4",
                label: "Mark 4 — bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 0,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "len4",
                label: "Mark 4 — cutting length",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
                min: 0,
            },
            { key: "n4", label: "Mark 4 — number of bars", default: 0, min: 0 },
            {
                key: "dia5",
                label: "Mark 5 — bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 0,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "len5",
                label: "Mark 5 — cutting length",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
                min: 0,
            },
            { key: "n5", label: "Mark 5 — number of bars", default: 0, min: 0 },
            {
                key: "wastage",
                label: "Wastage and lapping allowance",
                unit: "%",
                default: 3,
                min: 0,
                max: 20,
            },
        ],
        outputs: [
            {
                key: "totalWeight",
                label: "Total steel weight",
                unit: "kg",
                decimals: 1,
                hero: true,
            },
            {
                key: "totalTonne",
                label: "Total steel weight",
                unit: "tonne",
                decimals: 4,
            },
            { key: "mark1", label: "Mark 1 weight", unit: "kg", decimals: 1 },
            { key: "mark2", label: "Mark 2 weight", unit: "kg", decimals: 1 },
            { key: "mark3", label: "Mark 3 weight", unit: "kg", decimals: 1 },
            { key: "mark4", label: "Mark 4 weight", unit: "kg", decimals: 1 },
            { key: "mark5", label: "Mark 5 weight", unit: "kg", decimals: 1 },
            {
                key: "totalLength",
                label: "Total bar length",
                unit: "m",
                decimals: 1,
            },
            {
                key: "withWastage",
                label: "Weight with wastage",
                unit: "kg",
                decimals: 1,
            },
            {
                key: "marksUsed",
                label: "Bar marks used",
                unit: "nos",
                decimals: 0,
            },
        ],
        notes: [
            "Leave a mark's diameter at 0 to ignore that row.",
            "The wastage allowance covers cutting waste, laps and offcuts — typically 3–5%.",
            "Steel is ordered by weight, so round the total up to the nearest 50 kg or tonne.",
        ],
        compute: (v) => {
            const marks = [
                { dia: v.dia1 * MM, len: v.len1, count: v.n1 },
                { dia: v.dia2 * MM, len: v.len2, count: v.n2 },
                { dia: v.dia3 * MM, len: v.len3, count: v.n3 },
                { dia: v.dia4 * MM, len: v.len4, count: v.n4 },
                { dia: v.dia5 * MM, len: v.len5, count: v.n5 },
            ];

            const weights = marks.map((m) =>
                m.dia > 0 ? barUnitWeight(m.dia) * m.len * m.count : 0,
            );
            const lengths = marks.map((m) => (m.dia > 0 ? m.len * m.count : 0));

            const totalWeight = weights.reduce((a, b) => a + b, 0);
            const totalLength = lengths.reduce((a, b) => a + b, 0);

            return {
                mark1: weights[0],
                mark2: weights[1],
                mark3: weights[2],
                mark4: weights[3],
                mark5: weights[4],
                totalWeight,
                totalTonne: totalWeight / 1000,
                totalLength,
                withWastage: totalWeight * (1 + v.wastage / 100),
                marksUsed: marks.filter((m) => m.dia > 0).length,
            };
        },
    },
];
