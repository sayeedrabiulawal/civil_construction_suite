import type { ChartSeries } from "@/core/chart";
import type { Calculator } from "@/core/types";
import { concreteStressStrainCurve, steelStressStrainCurve } from "./charts";
import {
    CONCRETE_DENSITY,
    G,
    NOMINAL_MIX_OPTIONS,
    concreteMaterials,
    steelFromVolumePercentage,
} from "./shared";

const GRADE_INPUT = {
    key: "grade",
    label: "Concrete grade",
    kind: "select" as const,
    default: 4,
    options: NOMINAL_MIX_OPTIONS,
};

const STEEL_PERCENT_INPUT = {
    key: "steelPercent",
    label: "Reinforcement percentage",
    default: 0.8,
    min: 0,
    max: 6,
    step: 0.05,
    help: "% of concrete volume. Slabs 0.5–1%, beams 1–2%, columns 1–4%.",
};

/** Volume, self weight, steel and the full material breakdown for a member. */
function memberQuantity(volumeM3: number, grade: number, steelPercent: number) {
    const m = concreteMaterials(volumeM3, grade, { wastage: 0 });
    return {
        volume: volumeM3,
        weight: volumeM3 * CONCRETE_DENSITY,
        steel: steelFromVolumePercentage(volumeM3, steelPercent),
        cementBags: m.cementBags,
        cementKg: m.cementKg,
        sandM3: m.sandM3,
        aggM3: m.aggM3,
        water: m.waterL,
    };
}

export const RCC_CALCULATORS: Calculator[] = [
    {
        id: "slab-concrete",
        name: "RCC Slab Quantity",
        category: "rcc",
        tags: [
            "slab",
            "rcc",
            "concrete",
            "volume",
            "steel",
            "one way",
            "two way",
        ],
        summary: "Concrete volume, materials and steel for an RCC slab.",
        formula:
            "Volume = Length × Width × Thickness\nConcrete mass = Volume × 2500 kg/m³\nSteel = Volume × steel % × 7850 kg/m³",
        reference:
            "IS 456:2000. Slab thickness is usually 100–150 mm for residential floors.",
        inputs: [
            {
                key: "length",
                label: "Slab length",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "width",
                label: "Slab width",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "thickness",
                label: "Slab thickness",
                quantity: "length",
                defaultUnit: "mm",
                default: 125,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            GRADE_INPUT,
            STEEL_PERCENT_INPUT,
            {
                key: "count",
                label: "Number of identical slabs",
                default: 1,
                min: 1,
            },
        ],
        outputs: [
            {
                key: "volume",
                label: "Concrete volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
                hero: true,
            },
            { key: "area", label: "Slab area", quantity: "area", unit: "m2" },
            {
                key: "weight",
                label: "Concrete mass",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "steel",
                label: "Reinforcement steel",
                quantity: "mass",
                unit: "kg",
                decimals: 1,
            },
            { key: "cementBags", label: "Cement", unit: "bags", decimals: 1 },
            {
                key: "sandM3",
                label: "Sand volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "aggM3",
                label: "Coarse aggregate volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "water",
                label: "Water",
                quantity: "volume",
                unit: "L",
                decimals: 0,
            },
        ],
        notes: [
            "Steel percentages are a quick estimate — a proper design gives exact bar schedules.",
            "Deduct openings such as stair wells and shafts before entering the plan area.",
        ],
        compute: (v) => {
            const volume = v.length * v.width * v.thickness * v.count;
            const q = memberQuantity(volume, v.grade, v.steelPercent);
            return { ...q, area: v.length * v.width * v.count };
        },
    },

    {
        id: "beam-concrete",
        name: "RCC Beam Quantity",
        category: "rcc",
        tags: [
            "beam",
            "rcc",
            "concrete",
            "volume",
            "steel",
            "plinth",
            "lintel",
        ],
        summary: "Concrete volume, materials and steel for RCC beams.",
        formula: "Volume = Length × Width × Depth × Number of beams",
        reference: "IS 456:2000. Typical beams are 230 × 300 to 300 × 600 mm.",
        inputs: [
            {
                key: "length",
                label: "Beam length",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "width",
                label: "Beam width",
                quantity: "length",
                defaultUnit: "mm",
                default: 230,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "depth",
                label: "Beam depth",
                quantity: "length",
                defaultUnit: "mm",
                default: 450,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            { key: "count", label: "Number of beams", default: 1, min: 1 },
            GRADE_INPUT,
            { ...STEEL_PERCENT_INPUT, default: 1.5 },
        ],
        outputs: [
            {
                key: "volume",
                label: "Concrete volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
                hero: true,
            },
            {
                key: "weight",
                label: "Concrete mass",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "steel",
                label: "Reinforcement steel",
                quantity: "mass",
                unit: "kg",
                decimals: 1,
            },
            { key: "cementBags", label: "Cement", unit: "bags", decimals: 1 },
            {
                key: "sandM3",
                label: "Sand volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "aggM3",
                label: "Coarse aggregate volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "water",
                label: "Water",
                quantity: "volume",
                unit: "L",
                decimals: 0,
            },
            {
                key: "formwork",
                label: "Formwork (sides + soffit)",
                quantity: "area",
                unit: "m2",
                decimals: 2,
            },
        ],
        compute: (v) => {
            const volume = v.length * v.width * v.depth * v.count;
            const q = memberQuantity(volume, v.grade, v.steelPercent);
            return {
                ...q,
                formwork: v.length * (v.width + 2 * v.depth) * v.count,
            };
        },
    },

    {
        id: "column-concrete",
        name: "RCC Column Quantity",
        category: "rcc",
        tags: ["column", "rcc", "concrete", "pillar", "volume", "steel"],
        summary: "Concrete volume, materials and steel for RCC columns.",
        formula: "Volume = Height × Width × Depth × Number of columns",
        reference:
            "IS 456:2000 Cl. 26.5.3.1 — longitudinal steel must be between 0.8% and 6% of the gross area.",
        inputs: [
            {
                key: "height",
                label: "Column height",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
            {
                key: "width",
                label: "Column width",
                quantity: "length",
                defaultUnit: "mm",
                default: 230,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "depth",
                label: "Column depth",
                quantity: "length",
                defaultUnit: "mm",
                default: 450,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            { key: "count", label: "Number of columns", default: 1, min: 1 },
            GRADE_INPUT,
            { ...STEEL_PERCENT_INPUT, default: 2 },
        ],
        outputs: [
            {
                key: "volume",
                label: "Concrete volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
                hero: true,
            },
            {
                key: "weight",
                label: "Concrete mass",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "steel",
                label: "Reinforcement steel",
                quantity: "mass",
                unit: "kg",
                decimals: 1,
            },
            { key: "cementBags", label: "Cement", unit: "bags", decimals: 1 },
            {
                key: "sandM3",
                label: "Sand volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "aggM3",
                label: "Coarse aggregate volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "water",
                label: "Water",
                quantity: "volume",
                unit: "L",
                decimals: 0,
            },
        ],
        notes: [
            "Steel below 0.8% or above 6% needs a redesign, not just a quantity change.",
            "Deduct the concrete displaced by the beam-slab junction at floor levels.",
        ],
        compute: (v) => {
            const volume = v.height * v.width * v.depth * v.count;
            return memberQuantity(volume, v.grade, v.steelPercent);
        },
    },

    {
        id: "footing-concrete",
        name: "RCC Footing Concrete Quantity",
        category: "rcc",
        tags: ["footing", "foundation", "rcc", "isolated", "pad", "concrete"],
        summary: "Concrete volume and materials for isolated (pad) footings.",
        formula: "Volume = Length × Width × Thickness × Number of footings",
        inputs: [
            {
                key: "length",
                label: "Footing length",
                quantity: "length",
                defaultUnit: "mm",
                default: 1500,
                allowedUnits: ["mm", "cm", "m", "ft"],
                min: 0,
            },
            {
                key: "width",
                label: "Footing width",
                quantity: "length",
                defaultUnit: "mm",
                default: 1500,
                allowedUnits: ["mm", "cm", "m", "ft"],
                min: 0,
            },
            {
                key: "thickness",
                label: "Footing thickness",
                quantity: "length",
                defaultUnit: "mm",
                default: 300,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            { key: "count", label: "Number of footings", default: 1, min: 1 },
            GRADE_INPUT,
            { ...STEEL_PERCENT_INPUT, default: 0.7 },
        ],
        outputs: [
            {
                key: "volume",
                label: "Concrete volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
                hero: true,
            },
            {
                key: "weight",
                label: "Concrete mass",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "steel",
                label: "Reinforcement steel",
                quantity: "mass",
                unit: "kg",
                decimals: 1,
            },
            {
                key: "planArea",
                label: "Total plan area",
                quantity: "area",
                unit: "m2",
                decimals: 2,
            },
            { key: "cementBags", label: "Cement", unit: "bags", decimals: 1 },
            {
                key: "sandM3",
                label: "Sand volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "aggM3",
                label: "Coarse aggregate volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "water",
                label: "Water",
                quantity: "volume",
                unit: "L",
                decimals: 0,
            },
        ],
        compute: (v) => {
            const volume = v.length * v.width * v.thickness * v.count;
            const q = memberQuantity(volume, v.grade, v.steelPercent);
            return { ...q, planArea: v.length * v.width * v.count };
        },
    },

    {
        id: "staircase-concrete",
        name: "RCC Staircase Quantity",
        category: "rcc",
        tags: [
            "staircase",
            "stair",
            "steps",
            "riser",
            "tread",
            "waist slab",
            "rcc",
        ],
        summary:
            "Concrete volume for a waist-slab staircase, including the steps.",
        formula:
            "Inclined waist length = √(Rise² + Tread²) × Number of steps\nWaist volume = Inclined length × Width × Waist thickness\nStep volume = ½ × Rise × Tread × Width × Number of steps",
        reference:
            "IS 456:2000. Comfortable proportions: 2R + T ≈ 600 mm, rise 150–190 mm, tread 250–300 mm.",
        inputs: [
            {
                key: "steps",
                label: "Number of steps",
                default: 12,
                min: 1,
                step: 1,
            },
            {
                key: "rise",
                label: "Riser height",
                quantity: "length",
                defaultUnit: "mm",
                default: 150,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "tread",
                label: "Tread width",
                quantity: "length",
                defaultUnit: "mm",
                default: 280,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "width",
                label: "Stair width",
                quantity: "length",
                defaultUnit: "m",
                default: 1.2,
                min: 0,
            },
            {
                key: "waist",
                label: "Waist slab thickness",
                quantity: "length",
                defaultUnit: "mm",
                default: 150,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            GRADE_INPUT,
        ],
        outputs: [
            {
                key: "volume",
                label: "Total concrete volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
                hero: true,
            },
            {
                key: "waistVolume",
                label: "Waist slab volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "stepVolume",
                label: "Steps volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "inclinedLength",
                label: "Inclined waist length",
                quantity: "length",
                unit: "m",
                decimals: 3,
            },
            {
                key: "height",
                label: "Total stair height",
                quantity: "length",
                unit: "m",
                decimals: 3,
            },
            { key: "cementBags", label: "Cement", unit: "bags", decimals: 1 },
            {
                key: "sandM3",
                label: "Sand volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
            {
                key: "aggM3",
                label: "Coarse aggregate volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
        ],
        compute: (v) => {
            const inclinedLength =
                Math.sqrt(v.rise * v.rise + v.tread * v.tread) * v.steps;
            const waistVolume = inclinedLength * v.width * v.waist;
            const stepVolume = 0.5 * v.rise * v.tread * v.width * v.steps;
            const volume = waistVolume + stepVolume;
            const m = concreteMaterials(volume, v.grade, { wastage: 0 });
            return {
                volume,
                waistVolume,
                stepVolume,
                inclinedLength,
                height: v.rise * v.steps,
                cementBags: m.cementBags,
                sandM3: m.sandM3,
                aggM3: m.aggM3,
            };
        },
    },

    {
        id: "column-load-capacity",
        name: "Short Column Load Capacity",
        category: "rcc",
        tags: [
            "column",
            "load",
            "capacity",
            "axial",
            "pu",
            "is 456",
            "short column",
        ],
        summary:
            "Axial load-carrying capacity of a short reinforced concrete column.",
        formula:
            "Pu = 0.4 fck Ac + 0.67 fy Asc\nAc = Ag − Asc,  Asc = n × π/4 × φ²",
        reference:
            "IS 456:2000 Cl. 39.3 — short columns with minimum eccentricity.",
        inputs: [
            {
                key: "width",
                label: "Column width",
                quantity: "length",
                defaultUnit: "mm",
                default: 230,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "depth",
                label: "Column depth",
                quantity: "length",
                defaultUnit: "mm",
                default: 450,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "fck",
                label: "Concrete grade fck",
                quantity: "pressure",
                defaultUnit: "MPa",
                default: 20,
                min: 0,
            },
            {
                key: "fy",
                label: "Steel grade fy",
                quantity: "pressure",
                defaultUnit: "MPa",
                default: 415,
                min: 0,
            },
            {
                key: "dia",
                label: "Main bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 16,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "bars",
                label: "Number of main bars",
                default: 6,
                min: 1,
                step: 1,
            },
            {
                key: "factor",
                label: "Load factor for working load",
                default: 1.5,
                min: 1,
                max: 2,
                step: 0.05,
            },
        ],
        outputs: [
            {
                key: "pu",
                label: "Ultimate capacity Pu",
                quantity: "force",
                unit: "kN",
                decimals: 1,
                hero: true,
            },
            {
                key: "safe",
                label: "Working (service) capacity",
                quantity: "force",
                unit: "kN",
                decimals: 1,
            },
            {
                key: "ag",
                label: "Gross area Ag",
                quantity: "area",
                unit: "mm2",
                decimals: 0,
            },
            {
                key: "asc",
                label: "Steel area Asc",
                quantity: "area",
                unit: "mm2",
                decimals: 0,
            },
            {
                key: "steelPercent",
                label: "Steel percentage",
                decimals: 2,
                help: "Must be between 0.8% and 6% (IS 456 Cl. 26.5.3.1)",
            },
            {
                key: "concreteShare",
                label: "Load carried by concrete",
                quantity: "force",
                unit: "kN",
                decimals: 1,
            },
            {
                key: "steelShare",
                label: "Load carried by steel",
                quantity: "force",
                unit: "kN",
                decimals: 1,
            },
        ],
        notes: [
            "Valid only for short columns (slenderness ratio < 12) and for minimum eccentricity.",
            "Biaxial bending, long columns and seismic detailing need a full design check.",
            "A minimum of 4 bars and 6 mm ties at the lesser of the least lateral dimension or 300 mm are required.",
        ],
        compute: (v) => {
            // Inputs arrive in metres, Pa and m; convert to the mm/MPa world of IS 456.
            const widthMm = v.width * 1000;
            const depthMm = v.depth * 1000;
            const diaMm = v.dia * 1000;
            const fckMpa = v.fck / 1e6;
            const fyMpa = v.fy / 1e6;

            const ag = widthMm * depthMm; // mm²
            const asc = (Math.PI / 4) * diaMm * diaMm * v.bars; // mm²
            const ac = Math.max(ag - asc, 0); // mm²

            // Pu = 0.4 fck Ac + 0.67 fy Asc, with stresses in MPa and areas in mm² -> N.
            const concreteN = 0.4 * fckMpa * ac;
            const steelN = 0.67 * fyMpa * asc;
            const puN = concreteN + steelN;

            // A load factor below 1 is not a valid design, so clamp it rather
            // than dividing by zero and reporting an infinite capacity.
            const factor = Math.max(v.factor, 1);

            return {
                pu: puN / 1000,
                safe: puN / factor / 1000,
                ag,
                asc,
                steelPercent: ag > 0 ? (asc / ag) * 100 : 0,
                concreteShare: concreteN / 1000,
                steelShare: steelN / 1000,
            };
        },
    },

    {
        id: "slab-dead-load",
        name: "Slab Dead Load & Factored Load",
        category: "rcc",
        tags: ["dead load", "slab", "load", "factored", "live load", "is 875"],
        summary:
            "Self weight, floor finish, live load and the factored design load for a slab.",
        formula:
            "Self weight = Thickness × 2500 kg/m³ × g\nDead load = Self weight + Floor finish\nFactored load = 1.5 × (Dead load + Live load)",
        reference:
            "IS 875 (Part 1 & 2) and IS 456:2000 Cl. 36.4 (load factors).",
        inputs: [
            {
                key: "thickness",
                label: "Slab thickness",
                quantity: "length",
                defaultUnit: "mm",
                default: 125,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "density",
                label: "Concrete density",
                quantity: "density",
                defaultUnit: "kgm3",
                default: 2500,
                min: 0,
            },
            {
                key: "floorFinish",
                label: "Floor finish load",
                quantity: "pressure",
                defaultUnit: "kNm2",
                default: 1.5,
                min: 0,
            },
            {
                key: "liveLoad",
                label: "Live (imposed) load",
                quantity: "pressure",
                defaultUnit: "kNm2",
                default: 3,
                min: 0,
            },
            {
                key: "deadFactor",
                label: "Dead load factor",
                default: 1.5,
                min: 1,
                max: 2,
                step: 0.05,
            },
            {
                key: "liveFactor",
                label: "Live load factor",
                default: 1.5,
                min: 1,
                max: 2.5,
                step: 0.05,
            },
        ],
        outputs: [
            {
                key: "factored",
                label: "Factored design load",
                quantity: "pressure",
                unit: "kNm2",
                decimals: 3,
                hero: true,
            },
            {
                key: "selfWeight",
                label: "Slab self weight",
                quantity: "pressure",
                unit: "kNm2",
                decimals: 3,
            },
            {
                key: "deadLoad",
                label: "Total dead load",
                quantity: "pressure",
                unit: "kNm2",
                decimals: 3,
            },
            {
                key: "serviceLoad",
                label: "Total service load",
                quantity: "pressure",
                unit: "kNm2",
                decimals: 3,
            },
            {
                key: "factoredDead",
                label: "Factored dead load",
                quantity: "pressure",
                unit: "kNm2",
                decimals: 3,
            },
            {
                key: "factoredLive",
                label: "Factored live load",
                quantity: "pressure",
                unit: "kNm2",
                decimals: 3,
            },
        ],
        notes: [
            "Typical live loads (IS 875 Part 2): residential 2.0, office 2.5–4.0, retail 4.0, storage 5.0+ kN/m².",
            "The 1.5 factor is the standard load combination 1.5(DL + LL) for limit state design.",
        ],
        compute: (v) => {
            // Pressures arrive in Pa; the outputs are reported in kN/m².
            const toKNm2 = 1 / 1000;
            const selfWeightPa = v.thickness * v.density * G;
            const deadPa = selfWeightPa + v.floorFinish;
            const servicePa = deadPa + v.liveLoad;
            return {
                selfWeight: selfWeightPa * toKNm2,
                deadLoad: deadPa * toKNm2,
                serviceLoad: servicePa * toKNm2,
                factored:
                    (v.deadFactor * deadPa + v.liveFactor * v.liveLoad) *
                    toKNm2,
                factoredDead: v.deadFactor * deadPa * toKNm2,
                factoredLive: v.liveFactor * v.liveLoad * toKNm2,
            };
        },
    },

    {
        id: "beam-design-singly-reinforced",
        name: "Beam Design (Singly Reinforced)",
        category: "rcc",
        tags: [
            "beam",
            "design",
            "flexure",
            "ast",
            "mu lim",
            "limiting moment",
            "is 456",
            "limit state",
        ],
        summary:
            "Tension steel for a rectangular beam at the limit state, with the limiting moment check.",
        formula:
            "d = D − cover − φ/2\nMu,lim = 0.36 (xu/d) (1 − 0.42 xu/d) fck b d²\nAst = 0.5 (fck/fy) [1 − √(1 − 4.6 Mu / (fck b d²))] b d",
        reference:
            "IS 456:2000 Cl. 38.1 for xu,max/d and Annex G for the flexural formulae.",
        inputs: [
            {
                key: "width",
                label: "Beam width b",
                quantity: "length",
                defaultUnit: "mm",
                default: 230,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "depth",
                label: "Overall depth D",
                quantity: "length",
                defaultUnit: "mm",
                default: 450,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "cover",
                label: "Effective cover",
                quantity: "length",
                defaultUnit: "mm",
                default: 40,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
                help: "Clear cover plus half the bar diameter",
            },
            {
                key: "dia",
                label: "Main bar diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 16,
                allowedUnits: ["mm", "cm", "in"],
                min: 0,
            },
            {
                key: "fck",
                label: "Concrete grade fck",
                unit: "MPa",
                default: 20,
                min: 0,
            },
            {
                key: "fy",
                label: "Steel grade fy",
                unit: "MPa",
                default: 415,
                min: 0,
            },
            {
                key: "mu",
                label: "Factored design moment Mu",
                unit: "kN·m",
                default: 100,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "ast",
                label: "Tension steel Ast",
                unit: "mm²",
                decimals: 0,
                hero: true,
            },
            { key: "sectionType", label: "Section type" },
            {
                key: "effectiveDepth",
                label: "Effective depth d",
                unit: "mm",
                decimals: 1,
            },
            {
                key: "muLim",
                label: "Limiting moment Mu,lim",
                unit: "kN·m",
                decimals: 2,
            },
            {
                key: "astMin",
                label: "Minimum steel (0.85 b d / fy)",
                unit: "mm²",
                decimals: 0,
            },
            {
                key: "astMax",
                label: "Maximum steel (4% of b D)",
                unit: "mm²",
                decimals: 0,
            },
            {
                key: "steelPercent",
                label: "Steel percentage pt",
                unit: "%",
                decimals: 2,
            },
            {
                key: "barsRequired",
                label: "Bars required",
                unit: "nos",
                decimals: 0,
            },
            {
                key: "astProvided",
                label: "Steel provided",
                unit: "mm²",
                decimals: 0,
            },
        ],
        notes: [
            "A doubly reinforced section is needed once Mu exceeds Mu,lim. This calculator then reports no steel area.",
            "Rounded up to whole bars, so the steel provided is normally a little above Ast.",
            "Shear reinforcement, deflection, development length and detailing must all be checked separately.",
            "The effective cover should include the link diameter — 40 mm is typical for a 25 mm cover with 8 mm links.",
        ],
        compute: (v) => {
            const b = v.width * 1000;
            const depthMm = v.depth * 1000;
            const coverMm = v.cover * 1000;
            const diaMm = v.dia * 1000;
            const d = depthMm - coverMm; // effective cover already includes φ/2

            const mu = v.mu * 1e6; // kN·m -> N·mm

            // xu,max/d from IS 456 Cl. 38.1.
            const xuRatio =
                v.fy <= 250
                    ? 0.53
                    : v.fy <= 415
                      ? 0.48
                      : v.fy <= 500
                        ? 0.46
                        : 0.44;
            const muLimNmm =
                0.36 * xuRatio * (1 - 0.42 * xuRatio) * v.fck * b * d * d;

            const k =
                v.fck > 0 && b > 0 && d > 0
                    ? (4.6 * mu) / (v.fck * b * d * d)
                    : 2;
            const ast =
                k < 1 && v.fck > 0 && v.fy > 0
                    ? 0.5 * (v.fck / v.fy) * (1 - Math.sqrt(1 - k)) * b * d
                    : NaN;

            const astMin = v.fy > 0 ? (0.85 * b * d) / v.fy : Number.NaN;
            // IS 456 Cl. 26.5.1.1 caps the tension steel at 4% of the GROSS area b D.
            const astMax = 0.04 * b * depthMm;
            const oneBar = (Math.PI / 4) * diaMm * diaMm;
            const barsRequired =
                oneBar > 0 && Number.isFinite(ast)
                    ? Math.ceil(ast / oneBar)
                    : 0;

            const singly = muLimNmm >= mu;

            return {
                ast,
                sectionType: singly
                    ? "Singly reinforced is adequate — Mu is within Mu,lim"
                    : "Mu exceeds Mu,lim — a doubly reinforced section is required",
                effectiveDepth: d,
                muLim: muLimNmm / 1e6,
                astMin,
                astMax,
                steelPercent:
                    b * d > 0 && Number.isFinite(ast)
                        ? (ast / (b * d)) * 100
                        : 0,
                barsRequired,
                astProvided: barsRequired * oneBar,
            };
        },
    },

    {
        id: "span-depth-check",
        name: "Deflection Check (Span / Depth Ratio)",
        category: "rcc",
        tags: [
            "deflection",
            "span depth ratio",
            "serviceability",
            "is 456",
            "cl 23.2",
            "slim member",
        ],
        summary:
            "Check the span to effective depth ratio against the IS 456 basic values and a modification factor.",
        formula:
            "Basic ratio: cantilever 7, simply supported 20, continuous 26\nAllowable ratio = basic × modification factor\nActual ratio = span ÷ effective depth",
        reference:
            "IS 456:2000 Cl. 23.2.1. The modification factor is read from Fig. 4 (or Fig. 5 for flanged sections).",
        inputs: [
            {
                key: "member",
                label: "Member type",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Cantilever (basic 7)" },
                    { value: 1, label: "Simply supported (basic 20)" },
                    { value: 2, label: "Continuous (basic 26)" },
                ],
            },
            {
                key: "span",
                label: "Effective span",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "depth",
                label: "Effective depth d",
                quantity: "length",
                defaultUnit: "mm",
                default: 400,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "mf",
                label: "Modification factor from Fig. 4",
                default: 1,
                min: 0.5,
                max: 2,
                step: 0.01,
                help: "Depends on the steel percentage and fy. 1.0 is the conservative default.",
            },
            {
                key: "pt",
                label: "Tension steel percentage pt",
                unit: "%",
                default: 0.5,
                min: 0,
                max: 3,
                step: 0.05,
                help: "Used only to help you pick the modification factor",
            },
        ],
        outputs: [
            { key: "status", label: "Verdict", hero: true },
            {
                key: "actualRatio",
                label: "Actual span / depth ratio",
                decimals: 2,
            },
            { key: "allowableRatio", label: "Allowable ratio", decimals: 2 },
            { key: "basicRatio", label: "Basic ratio", decimals: 1 },
            {
                key: "requiredDepth",
                label: "Minimum effective depth needed",
                unit: "mm",
                decimals: 0,
            },
            {
                key: "margin",
                label: "Spare capacity in the ratio",
                decimals: 2,
            },
        ],
        notes: [
            "This clause controls deflection for spans up to 10 m. Above 10 m the basic values are multiplied by 10/span.",
            "Cantilever spans above 10 m also use the 10/span reduction.",
            "The modification factor rises as the steel percentage falls, so keeping pt low helps satisfy the check.",
            "A passing ratio does not guarantee the deflection limit is met — it is an indirect check.",
        ],
        compute: (v) => {
            const spanMm = v.span * 1000;
            const d = v.depth * 1000;
            const basicRaw = [7, 20, 26][v.member];
            // Above 10 m spans the basic values are scaled by 10/span.
            const spanM = v.span;
            const basic = spanM > 10 ? basicRaw * (10 / spanM) : basicRaw;
            const allowable = basic * v.mf;
            const actual = d > 0 ? spanMm / d : 0;
            const required = allowable > 0 ? spanMm / allowable : 0;
            const ok = actual <= allowable;

            return {
                basicRatio: basic,
                allowableRatio: allowable,
                actualRatio: actual,
                requiredDepth: Math.ceil(required),
                margin: allowable - actual,
                status: ok
                    ? "OK — the span to depth ratio is within the IS 456 limit"
                    : `DEFLECTION LIKELY — increase the effective depth to at least ${Math.ceil(required)} mm`,
            };
        },
    },

    {
        id: "stirrup-shear-design",
        name: "Shear Design (Vertical Stirrups)",
        category: "rcc",
        tags: [
            "shear",
            "stirrup",
            "links",
            "tau c",
            "spacing",
            "is 456",
            "cl 40.4",
        ],
        summary:
            "Spacing of vertical stirrups from the shear capacity of the concrete and the links.",
        formula: "τv = Vu ÷ (b d)\nVus = Vu − τc b d\nSv = 0.87 fy Asv d ÷ Vus",
        reference:
            "IS 456:2000 Cl. 40.4 and Table 19 for τc, Table 20 for τc,max.",
        inputs: [
            {
                key: "width",
                label: "Beam width b",
                quantity: "length",
                defaultUnit: "mm",
                default: 230,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "depth",
                label: "Effective depth d",
                quantity: "length",
                defaultUnit: "mm",
                default: 400,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "grade",
                label: "Concrete grade",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "M20" },
                    { value: 1, label: "M25" },
                ],
            },
            {
                key: "pt",
                label: "Tension steel percentage pt",
                unit: "%",
                default: 0.5,
                min: 0.15,
                max: 3,
                step: 0.05,
                help: "Needed to read τc from IS 456 Table 19",
            },
            {
                key: "vu",
                label: "Factored shear force Vu",
                unit: "kN",
                default: 80,
                min: 0,
            },
            {
                key: "stirrupDia",
                label: "Stirrup diameter",
                unit: "mm",
                default: 8,
                min: 0,
            },
            {
                key: "legs",
                label: "Number of stirrup legs",
                default: 2,
                min: 1,
                step: 1,
            },
            {
                key: "fy",
                label: "Stirrup steel fy",
                unit: "MPa",
                default: 415,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "providedSpacing",
                label: "Stirrup spacing to adopt",
                unit: "mm",
                decimals: 0,
                hero: true,
            },
            { key: "status", label: "Verdict" },
            {
                key: "tauV",
                label: "Nominal shear stress τv",
                unit: "N/mm²",
                decimals: 3,
            },
            {
                key: "tauC",
                label: "Concrete shear strength τc",
                unit: "N/mm²",
                decimals: 3,
            },
            {
                key: "tauCMax",
                label: "Maximum τc,max",
                unit: "N/mm²",
                decimals: 2,
            },
            {
                key: "vus",
                label: "Shear to be carried by the links Vus",
                unit: "kN",
                decimals: 2,
            },
            { key: "asv", label: "Link area Asv", unit: "mm²", decimals: 1 },
            {
                key: "svStrength",
                label: "Spacing from the strength criterion",
                unit: "mm",
                decimals: 0,
            },
            {
                key: "svMax",
                label: "Maximum spacing limit (0.75d or 300)",
                unit: "mm",
                decimals: 0,
            },
            {
                key: "svMinReinf",
                label: "Spacing limit for minimum shear reinforcement",
                unit: "mm",
                decimals: 0,
            },
        ],
        notes: [
            "τc is read from IS 456 Table 19 by linear interpolation on pt, for M20 and M25 only. For other grades read the table directly.",
            "The lowest of the three limits governs. The spacing is then rounded down to a 25 mm multiple.",
            "If τv exceeds τc,max the section must be enlarged — do not simply add more links.",
            "Stirrups are never spaced further apart than 0.75d or 300 mm, whichever is less.",
        ],
        compute: (v) => {
            const b = v.width * 1000;
            const d = v.depth * 1000;
            const vuN = v.vu * 1000;
            const tauV = b > 0 && d > 0 ? vuN / (b * d) : 0;

            // IS 456 Table 19 (pt in %, τc in N/mm²).
            const table =
                v.grade === 0
                    ? [
                          [0.15, 0.28],
                          [0.25, 0.36],
                          [0.5, 0.48],
                          [0.75, 0.56],
                          [1.0, 0.62],
                          [1.25, 0.67],
                          [1.5, 0.72],
                          [1.75, 0.75],
                          [2.0, 0.79],
                          [2.25, 0.81],
                          [2.5, 0.82],
                          [2.75, 0.82],
                          [3.0, 0.82],
                      ]
                    : [
                          [0.15, 0.29],
                          [0.25, 0.36],
                          [0.5, 0.49],
                          [0.75, 0.57],
                          [1.0, 0.64],
                          [1.25, 0.7],
                          [1.5, 0.74],
                          [1.75, 0.78],
                          [2.0, 0.82],
                          [2.25, 0.85],
                          [2.5, 0.88],
                          [2.75, 0.9],
                          [3.0, 0.92],
                      ];

            let tauC = table[table.length - 1][1];
            if (v.pt <= table[0][0]) {
                tauC = table[0][1];
            } else {
                for (let i = 1; i < table.length; i += 1) {
                    const [x1, y1] = table[i - 1];
                    const [x2, y2] = table[i];
                    if (v.pt <= x2) {
                        tauC = y1 + ((y2 - y1) * (v.pt - x1)) / (x2 - x1);
                        break;
                    }
                }
            }

            const tauCMax = v.grade === 0 ? 2.8 : 3.1;
            const vus = Math.max(vuN - tauC * b * d, 0);
            const asv = v.legs * (Math.PI / 4) * v.stirrupDia * v.stirrupDia;

            const svStrength =
                vus > 0
                    ? (0.87 * v.fy * asv * d) / vus
                    : Number.POSITIVE_INFINITY;
            const svMax = Math.min(0.75 * d, 300);
            const svMinReinf = b > 0 ? (0.87 * v.fy * asv) / (0.4 * b) : 0;

            const limit = Math.min(svStrength, svMax, svMinReinf);
            const provided =
                Number.isFinite(limit) && limit > 0
                    ? Math.floor(limit / 25) * 25
                    : 0;

            let status: string;
            if (tauV > tauCMax)
                status = "τv exceeds τc,max — enlarge the section";
            else if (vus <= 0)
                status =
                    "Concrete alone is adequate — provide nominal stirrups at the limit shown";
            else status = "Design the links for the spacing shown";

            return {
                providedSpacing: provided,
                status,
                tauV,
                tauC,
                tauCMax,
                vus: vus / 1000,
                asv,
                svStrength: Number.isFinite(svStrength) ? svStrength : 0,
                svMax,
                svMinReinf,
            };
        },
    },

    {
        id: "concrete-stress-block",
        name: "Concrete Stress Block & Stress–Strain",
        category: "rcc",
        tags: [
            "stress block",
            "stress strain",
            "parabolic",
            "xu max",
            "limiting moment",
            "mu lim",
            "0.36 fck",
            "0.138",
        ],
        summary:
            "The IS 456 stress–strain curve for concrete, the limiting neutral axis depth and the limiting moment of resistance.",
        formula:
            "σ = 0.67 fck [ 2(ε/ε₀) − (ε/ε₀)² ]   for ε ≤ 0.002\nσ = 0.67 fck                          for 0.002 < ε ≤ 0.0035\nMu,lim = 0.36 (xu,max/d) [ 1 − 0.42 (xu,max/d) ] fck b d²",
        reference:
            "IS 456:2000 Cl. 38.1 and Fig. 21 (stress–strain curve), Cl. 38.1.1 (limiting values of xu/d).",
        notes: [
            "The design stress block replaces the parabola with a uniform 0.36 fck over 0.42 xu. It is a simplification chosen so that the concrete force and its lever arm match the parabola.",
            "xu,max/d is 0.53 for Fe 250, 0.48 for Fe 415 and 0.46 for Fe 500 (IS 456 Cl. 38.1).",
            "The limiting moment coefficient is the familiar 0.138 for Fe 415, 0.148 for Fe 250 and 0.133 for Fe 500.",
            "Effective depth d is measured to the centroid of the tension steel, so deduct the cover and half a bar diameter from the overall depth.",
            "A section carrying more than Mu,lim needs compression reinforcement or a larger section.",
        ],
        inputs: [
            {
                key: "fck",
                label: "Characteristic cube strength fck",
                unit: "MPa",
                default: 20,
                min: 15,
                max: 60,
            },
            {
                key: "steel",
                label: "Steel grade",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Fe 250 — xu,max/d = 0.53" },
                    { value: 1, label: "Fe 415 — xu,max/d = 0.48" },
                    { value: 2, label: "Fe 500 — xu,max/d = 0.46" },
                ],
            },
            {
                key: "b",
                label: "Section width b",
                unit: "mm",
                default: 230,
                min: 1,
            },
            {
                key: "d",
                label: "Effective depth d",
                unit: "mm",
                default: 450,
                min: 1,
            },
        ],
        outputs: [
            {
                key: "muLim",
                label: "Limiting moment of resistance Mu,lim",
                unit: "kN·m",
                decimals: 2,
                hero: true,
            },
            {
                key: "xuLimit",
                label: "Limiting neutral axis depth xu,max",
                unit: "mm",
                decimals: 1,
            },
            {
                key: "coefficient",
                label: "Mu,lim coefficient (Mu,lim / fck b d²)",
                decimals: 4,
            },
            {
                key: "peakStress",
                label: "Peak stress 0.67 fck",
                unit: "MPa",
                decimals: 2,
            },
            {
                key: "blockStress",
                label: "Design stress block 0.36 fck",
                unit: "MPa",
                decimals: 2,
            },
            {
                key: "ultimateStrain",
                label: "Ultimate concrete strain",
                decimals: 4,
            },
            { key: "verdict", label: "Section type" },
        ],
        compute: (v) => {
            const fck = Math.max(v.fck, 0);
            const k = [0.53, 0.48, 0.46][v.steel] ?? 0.48;
            const b = Math.max(v.b, 0);
            const d = Math.max(v.d, 0);

            const coefficient = 0.36 * k * (1 - 0.42 * k);
            // N·mm -> kN·m
            const muLim = (coefficient * fck * b * d * d) / 1e6;

            return {
                muLim,
                xuLimit: k * d,
                coefficient,
                peakStress: 0.67 * fck,
                blockStress: 0.36 * fck,
                ultimateStrain: 0.0035,
                verdict: `Under-reinforced up to xu = ${k.toFixed(2)} d`,
            };
        },
        chart: (v) => {
            const fck = Math.max(v.fck, 0);
            if (!(fck > 0)) return null;

            const blockStress = 0.36 * fck;

            return {
                title: "Concrete stress–strain curve (IS 456)",
                x: {
                    label: "Strain (%)",
                    min: 0,
                    max: 0.35,
                    ticks: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35],
                    format: (t) => t.toFixed(2),
                },
                y: { label: "Stress (MPa)", min: 0 },
                series: [
                    {
                        name: "Parabolic curve, 0.67 fck",
                        tone: "primary",
                        points: concreteStressStrainCurve(fck),
                        area: true,
                    },
                    {
                        name: "Design stress block, 0.36 fck",
                        tone: "danger",
                        dashed: true,
                        points: [
                            { x: 0, y: blockStress },
                            { x: 0.35, y: blockStress },
                        ],
                    },
                    {
                        name: "Peak at ε₀ = 0.002",
                        tone: "success",
                        markers: true,
                        points: [{ x: 0.2, y: 0.67 * fck }],
                    },
                ],
                caption:
                    "IS 456 Fig. 21. The parabola is the real material behaviour; the dashed line is the uniform 0.36 fck block used for design, which is why the stress block gives the same force as the curve.",
                aspect: 2.1,
            };
        },
    },

    {
        id: "steel-stress-strain",
        name: "Reinforcement Stress–Strain Curve",
        category: "rcc",
        tags: [
            "steel stress strain",
            "yield strain",
            "es",
            "0.87 fy",
            "fe415",
            "fe500",
            "ductility",
            "youngs modulus",
        ],
        summary:
            "Idealised stress–strain curve for reinforcement, with the yield strain and the design yield stress used by IS 456.",
        formula:
            "σ = Es ε                    for ε ≤ εy = fy / Es\nσ = fy                      for εy < ε ≤ 0.10 (idealised)\nDesign yield stress = 0.87 fy",
        reference:
            "IS 456:2000 Cl. 38.1 and Annex C — the idealised elasto-plastic curve with Es = 200 000 MPa.",
        notes: [
            "The design yield stress is 0.87 fy: a partial safety factor of 1.15 on the characteristic strength, which is what the code uses for reinforcement.",
            "A linear-elastic-perfectly-plastic idealisation ignores strain hardening. It is slightly conservative, which is why the code permits it.",
            "Yield strain is roughly 0.21% for Fe 415 and 0.25% for Fe 500 — small compared with the concrete's 0.35% ultimate strain.",
            "For flexural members the code also requires that the actual tensile strain in the steel at failure be at least 0.002 above the yield strain (Cl. 42.1), which is what makes a section ductile.",
            "Low ductility from cold-worked or low-elongation steel is a common cause of brittle failures, so check the elongation percentage on the mill certificate.",
        ],
        inputs: [
            {
                key: "grade",
                label: "Steel grade",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Fe 250 (mild steel)" },
                    { value: 1, label: "Fe 415" },
                    { value: 2, label: "Fe 500" },
                    { value: 3, label: "Fe 550" },
                ],
            },
            {
                key: "es",
                label: "Modulus of elasticity Es",
                unit: "MPa",
                default: 200000,
                min: 100000,
                max: 250000,
                step: 1000,
            },
            {
                key: "maxStrain",
                label: "Strain range to plot",
                unit: "%",
                default: 1,
                min: 0.1,
                max: 10,
                step: 0.1,
                help: "IS 456 assumes an ultimate strain of 10% (0.10)",
            },
        ],
        outputs: [
            {
                key: "designStress",
                label: "Design yield stress 0.87 fy",
                unit: "MPa",
                decimals: 1,
                hero: true,
            },
            {
                key: "yieldStrain",
                label: "Yield strain εy",
                unit: "%",
                decimals: 4,
            },
            {
                key: "yieldStrainPlain",
                label: "Yield strain (as a decimal)",
                decimals: 6,
            },
            {
                key: "characteristicStress",
                label: "Characteristic yield stress fy",
                unit: "MPa",
                decimals: 0,
            },
            {
                key: "modulus",
                label: "Modulus Es",
                unit: "GPa",
                decimals: 1,
            },
            {
                key: "stressAtRange",
                label: "Stress at the end of the plotted range",
                unit: "MPa",
                decimals: 1,
            },
            { key: "ductility", label: "Ductility check" },
        ],
        compute: (v) => {
            const fy = [250, 415, 500, 550][v.grade] ?? 415;
            const es = Math.max(v.es, 1);
            const range = Math.max(v.maxStrain, 0.01) / 100;
            const yieldStrain = fy / es;

            // The idealised curve is flat after yield, so past the yield point the
            // stress is simply fy — but before it the steel is still elastic.
            const stressAtRange = range <= yieldStrain ? es * range : fy;

            return {
                designStress: 0.87 * fy,
                yieldStrain: yieldStrain * 100,
                yieldStrainPlain: yieldStrain,
                characteristicStress: fy,
                modulus: es / 1000,
                stressAtRange,
                ductility:
                    yieldStrain < 0.01
                        ? "Ductile — yields well before the 1% strain the code assumes at failure"
                        : "Low ductility — check the elongation certificate",
            };
        },
        chart: (v) => {
            const fy = [250, 415, 500, 550][v.grade] ?? 415;
            const es = Math.max(v.es, 1);
            const range = Math.max(v.maxStrain, 0.1) / 100;
            const yieldStrain = fy / es;

            const series: ChartSeries[] = [
                {
                    name: `Idealised curve — fy = ${fy} MPa`,
                    tone: "primary",
                    points: steelStressStrainCurve(fy, es, range),
                },
                {
                    name: "Design yield 0.87 fy",
                    tone: "danger",
                    dashed: true,
                    points: [
                        { x: 0, y: 0.87 * fy },
                        { x: range * 100, y: 0.87 * fy },
                    ],
                },
            ];

            // A marker only helps when the yield point is inside the plotted range.
            if (yieldStrain <= range)
                series.push({
                    name: "Yield point",
                    tone: "success",
                    markers: true,
                    points: [{ x: yieldStrain * 100, y: fy }],
                });

            return {
                title: "Reinforcement stress–strain curve",
                x: {
                    label: "Strain (%)",
                    min: 0,
                    max: range * 100,
                },
                y: { label: "Stress (MPa)", min: 0, max: Math.max(fy, 1) },
                series,
                caption:
                    "Linear-elastic up to yield, then a constant plateau. Strain hardening beyond the plateau is real but ignored for design.",
                aspect: 2.1,
            };
        },
    },
];
