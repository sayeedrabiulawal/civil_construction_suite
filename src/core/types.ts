/**
 * Core domain types for Civil Construction Suite.
 *
 * Design principle: a calculator is DATA, not a screen.
 * Adding calculator #101 should mean writing one object in `src/calculators/`
 * and nothing else — no new UI, no new route, no new component.
 */

import type { ChartSpec } from "./chart";

/** Physical quantities that can carry a unit. `none` means a plain number. */
export type Quantity =
    | "length"
    | "area"
    | "volume"
    | "mass"
    | "force"
    | "pressure"
    | "density"
    | "unitWeight"
    | "flow"
    | "velocity"
    | "time"
    | "angle"
    | "temperature"
    | "money"
    | "none";

export type CategoryId =
    | "materials"
    | "concrete"
    | "steel"
    | "rcc"
    | "foundation"
    | "soil"
    | "surveying"
    | "hydraulics"
    | "transportation"
    | "geometry"
    | "convert"
    | "boq";

export interface Category {
    id: CategoryId;
    name: string;
    icon: string;
    blurb: string;
}

export interface SelectOption {
    value: number;
    label: string;
}

/** A single user input on a calculator. */
export interface InputField {
    key: string;
    label: string;
    /** Defaults to `number`. */
    kind?: "number" | "select" | "bool";
    /** Give this a real quantity to get a unit dropdown (mm/cm/m/ft/in...). */
    quantity?: Quantity;
    /** Preselected unit id, e.g. `'mm'`. */
    defaultUnit?: string;
    /** Restrict the unit dropdown to these unit ids. */
    allowedUnits?: string[];
    /**
     * Display-only unit suffix for plain-number inputs that carry no unit
     * dropdown (e.g. `'%'`, `'kN·m'`). Purely a label — never converted.
     */
    unit?: string;
    default?: number | boolean;
    min?: number;
    max?: number;
    step?: number;
    help?: string;
    /** Required when `kind === 'select'`. */
    options?: SelectOption[];
}

/** A single number the calculator produces. */
export interface OutputField {
    key: string;
    label: string;
    /**
     * Physical quantity this output represents. Informational only — used for
     * labelling. The engine does NOT convert outputs.
     */
    quantity?: Quantity;
    /**
     * Unit label shown next to the value. `compute` must return the number
     * already expressed in this unit, e.g. `unit: 'mm'` means return millimetres.
     */
    unit?: string;
    /** Fixed number of decimals. Omit for automatic precision. */
    decimals?: number;
    /** Render as a large headline result. */
    hero?: boolean;
    help?: string;
}

/** Values handed to `compute`. Unit-bearing inputs are already in SI base units. */
export type CalcValues = Record<string, number>;

/**
 * A calculator's raw output. Usually numbers, but some calculators report a
 * text result such as a soil classification or a pass/fail verdict.
 */
export type CalcResult = Record<string, number | string>;

export interface Calculator {
    id: string;
    name: string;
    category: CategoryId;
    /** Extra search keywords. */
    tags?: string[];
    summary: string;
    /** Human-readable formula, shown on the calculator page. */
    formula?: string;
    /** Code / textbook reference, e.g. "IS 456:2000, Cl. 26.2.1". */
    reference?: string;
    /** Extra notes, assumptions or warnings. */
    notes?: string[];
    inputs: InputField[];
    outputs: OutputField[];
    compute: (v: CalcValues) => CalcResult;
    /**
     * Optional chart, given the same SI values as `compute`.
     *
     * Returning `null` means "no chart for these inputs", which keeps a chart
     * from being drawn when the numbers do not describe anything meaningful.
     * The chart is a data structure — see `core/chart.ts` — so it can be drawn
     * on screen as SVG and into a PDF as vector paths.
     */
    chart?: (v: CalcValues) => ChartSpec | null;
}

/** A single computed output, ready to render. */
export interface ComputedRow {
    field: OutputField;
    value: number;
    /** True when the value is text rather than a number. */
    isText?: boolean;
    text: string;
}

/** Saved calculation in history. */
export interface HistoryEntry {
    id: string;
    calcId: string;
    calcName: string;
    at: number;
    /** Human-readable input summary, e.g. "Length 5 m, Width 3 m". */
    inputs: string;
    /** Headline result text. */
    result: string;
}

/* ------------------------------------------------------------------ *
 * Bill of Quantities
 * ------------------------------------------------------------------ */

/** A single measured item in a bill of quantities. */
export interface BoqLine {
    id: string;
    /** Item description, e.g. "Brickwork in cement mortar 1:6". */
    description: string;
    /** Unit of measurement: m³, m², m, kg, tonne, nos, LS... */
    unit: string;
    quantity: number;
    /** Rate per unit. */
    rate: number;
    /** Optional note, e.g. the IS code clause or a location. */
    remarks: string;
}

/** Grouping parameters applied to a project's subtotal. */
export interface BoqTerms {
    /** Percentage of the subtotal for unforeseen work. */
    contingency: number;
    /** Percentage of the subtotal for the contractor's margin. */
    overhead: number;
    /** Percentage applied after contingency and overhead. */
    tax: number;
}

/** A named BOQ, e.g. one per project or per tender. */
export interface BoqProject {
    id: string;
    name: string;
    /** Free text: client, location, tender reference. */
    client: string;
    currency: string;
    lines: BoqLine[];
    terms: BoqTerms;
    createdAt: number;
    updatedAt: number;
}

/** Computed roll-up of a project. */
export interface BoqTotals {
    subtotal: number;
    contingencyAmount: number;
    overheadAmount: number;
    beforeTax: number;
    taxAmount: number;
    grandTotal: number;
    lineCount: number;
    /** Quantity of each distinct unit, e.g. { 'm³': 42, nos: 15 }. */
    quantityByUnit: Record<string, number>;
}
