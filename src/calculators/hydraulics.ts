import type { Calculator } from "@/core/types";
import { G } from "./shared";

/**
 * Hydraulics calculators.
 *
 * Inputs arrive in SI base units (m, m², m³/s, m/s, N/m³). Discharge outputs are
 * shown in L/s or MLD, so `compute` converts the SI value explicitly.
 */
const M3S_TO_LS = 1000;
/** 1 MLD = 1000 m³/day = 1000/86400 m³/s, so m³/s -> MLD is × 86.4. */
const M3S_TO_MLD = 86400 / 1000;

export const HYDRAULIC_CALCULATORS: Calculator[] = [
    {
        id: "pipe-discharge",
        name: "Pipe Discharge & Velocity",
        category: "hydraulics",
        tags: [
            "pipe",
            "discharge",
            "flow",
            "velocity",
            "continuity",
            "area",
            "water supply",
        ],
        summary:
            "Discharge, velocity and pipe area from the continuity equation.",
        formula: "A = π D² / 4   |   Q = A × V",
        reference:
            "Continuity equation. Practical velocities for water supply mains: 0.6–1.5 m/s.",
        inputs: [
            {
                key: "dia",
                label: "Internal pipe diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 150,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "mode",
                label: "What do you want to find?",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "Discharge (enter velocity)" },
                    { value: 1, label: "Velocity (enter discharge)" },
                ],
            },
            {
                key: "velocity",
                label: "Velocity of flow",
                quantity: "velocity",
                defaultUnit: "ms",
                default: 1.2,
                min: 0,
            },
            {
                key: "discharge",
                label: "Discharge",
                quantity: "flow",
                defaultUnit: "Ls",
                default: 20,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "qLs",
                label: "Discharge",
                unit: "L/s",
                decimals: 2,
                hero: true,
            },
            { key: "qM3s", label: "Discharge", unit: "m³/s", decimals: 5 },
            { key: "qMLD", label: "Discharge", unit: "MLD", decimals: 3 },
            { key: "v", label: "Velocity", unit: "m/s", decimals: 3 },
            {
                key: "area",
                label: "Pipe cross-sectional area",
                unit: "m²",
                decimals: 5,
            },
        ],
        notes: [
            "Keep velocities below about 2 m/s to avoid excessive head loss and water hammer.",
            "For gravity sewers, design velocities are typically 0.6–3.0 m/s: self-cleansing but not scouring.",
        ],
        compute: (v) => {
            const area = (Math.PI / 4) * v.dia * v.dia; // m²
            const q = v.mode === 0 ? area * v.velocity : v.discharge; // m³/s
            return {
                qLs: q * M3S_TO_LS,
                qM3s: q,
                qMLD: q * M3S_TO_MLD,
                v: area > 0 ? q / area : 0,
                area,
            };
        },
    },

    {
        id: "manning-flow",
        name: "Open Channel Flow (Manning's)",
        category: "hydraulics",
        tags: [
            "manning",
            "open channel",
            "canal",
            "drain",
            "n value",
            "hydraulic radius",
            "gravity flow",
        ],
        summary:
            "Velocity and discharge in an open channel using Manning's equation.",
        formula: "V = (1/n) × R^(2/3) × S^(1/2)\nR = A / P,   Q = A × V",
        reference:
            "Manning's equation. Typical n: concrete 0.013–0.015, earth 0.022–0.030, rubble 0.025–0.035.",
        inputs: [
            {
                key: "n",
                label: "Manning roughness coefficient n",
                default: 0.013,
                min: 0.005,
                max: 0.1,
                step: 0.001,
            },
            {
                key: "area",
                label: "Flow cross-sectional area A",
                quantity: "area",
                defaultUnit: "m2",
                default: 1.2,
                min: 0,
            },
            {
                key: "perimeter",
                label: "Wetted perimeter P",
                quantity: "length",
                defaultUnit: "m",
                default: 2.4,
                min: 0,
            },
            {
                key: "topWidth",
                label: "Top width of the water surface T",
                quantity: "length",
                defaultUnit: "m",
                default: 1.5,
                min: 0,
            },
            {
                key: "slope",
                label: "Channel bed slope S",
                default: 0.001,
                min: 0,
                step: 0.0001,
                help: "m per m (0.001 = 1 in 1000)",
            },
        ],
        outputs: [
            {
                key: "qM3s",
                label: "Discharge Q",
                unit: "m³/s",
                decimals: 4,
                hero: true,
            },
            { key: "qLs", label: "Discharge Q", unit: "L/s", decimals: 2 },
            { key: "v", label: "Velocity V", unit: "m/s", decimals: 4 },
            { key: "r", label: "Hydraulic radius R", unit: "m", decimals: 4 },
            {
                key: "froude",
                label: "Froude number",
                decimals: 3,
                help: "Below 1 subcritical, above 1 supercritical",
            },
        ],
        notes: [
            "Manning's equation assumes uniform, steady, turbulent flow in a prismatic channel.",
            "For a rectangular channel A = b y and P = b + 2y; for a trapezoid add the side slopes.",
            "A Froude number near 1 means critical flow, which should be avoided in design.",
        ],
        compute: (v) => {
            const r = v.perimeter > 0 ? v.area / v.perimeter : 0;
            const velocity =
                v.n > 0
                    ? (1 / v.n) *
                      Math.pow(Math.max(r, 0), 2 / 3) *
                      Math.sqrt(Math.max(v.slope, 0))
                    : 0;
            const q = v.area * velocity;
            // Hydraulic depth D = A / T and Froude number Fr = V / √(gD).
            const hydraulicDepth = v.topWidth > 0 ? v.area / v.topWidth : 0;
            return {
                qM3s: q,
                qLs: q * M3S_TO_LS,
                v: velocity,
                r,
                froude:
                    hydraulicDepth > 0
                        ? velocity / Math.sqrt(G * hydraulicDepth)
                        : 0,
            };
        },
    },

    {
        id: "hazen-williams",
        name: "Pipe Head Loss (Hazen-Williams)",
        category: "hydraulics",
        tags: [
            "hazen williams",
            "head loss",
            "friction",
            "pipe",
            "water supply",
            "c value",
        ],
        summary: "Friction head loss and velocity in a full flowing pipe.",
        formula: "hf = 10.67 L Q^1.852 / (C^1.852 D^4.87)   (SI)\nV = Q / A",
        reference:
            "Hazen-Williams (SI form). Typical C: new steel 120–130, cast iron 100, PVC 140–150.",
        inputs: [
            {
                key: "discharge",
                label: "Discharge Q",
                quantity: "flow",
                defaultUnit: "Ls",
                default: 25,
                min: 0,
            },
            {
                key: "dia",
                label: "Internal diameter D",
                quantity: "length",
                defaultUnit: "mm",
                default: 150,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "length",
                label: "Pipe length L",
                quantity: "length",
                defaultUnit: "m",
                default: 500,
                min: 0,
            },
            {
                key: "c",
                label: "Hazen-Williams coefficient C",
                default: 120,
                min: 60,
                max: 160,
                step: 1,
            },
        ],
        outputs: [
            {
                key: "hf",
                label: "Friction head loss hf",
                unit: "m",
                decimals: 3,
                hero: true,
            },
            {
                key: "velocity",
                label: "Flow velocity V",
                unit: "m/s",
                decimals: 3,
            },
            {
                key: "gradient",
                label: "Hydraulic gradient",
                decimals: 6,
                help: "m of head per m of pipe",
            },
            {
                key: "headPerKm",
                label: "Head loss per km",
                unit: "m/km",
                decimals: 3,
            },
        ],
        notes: [
            "Valid for water at ordinary temperatures in pipes 50 mm and larger.",
            "Add minor losses from bends, valves and fittings separately — often 5–10% of the friction loss.",
            "Keep velocity below about 2 m/s to limit head loss and surge.",
        ],
        compute: (v) => {
            const area = (Math.PI / 4) * v.dia * v.dia;
            const velocity = area > 0 ? v.discharge / area : 0;
            const hf =
                v.c > 0 && v.dia > 0
                    ? (10.67 * v.length * Math.pow(v.discharge, 1.852)) /
                      (Math.pow(v.c, 1.852) * Math.pow(v.dia, 4.87))
                    : 0;
            return {
                hf,
                velocity,
                gradient: v.length > 0 ? hf / v.length : 0,
                headPerKm: v.length > 0 ? (hf / v.length) * 1000 : 0,
            };
        },
    },

    {
        id: "rational-method-runoff",
        name: "Peak Runoff (Rational Method)",
        category: "hydraulics",
        tags: [
            "runoff",
            "rational method",
            "storm",
            "drainage",
            "catchment",
            "flood",
            "rainfall",
        ],
        summary:
            "Peak storm water runoff from a catchment using the rational method.",
        formula: "Q = C × i × A / 360",
        reference:
            "Q in m³/s, i in mm/hour, A in hectares. Suits catchments under about 50 ha.",
        inputs: [
            {
                key: "c",
                label: "Runoff coefficient C",
                default: 0.75,
                min: 0.05,
                max: 1,
                step: 0.05,
            },
            {
                key: "intensity",
                label: "Rainfall intensity i",
                unit: "mm/h",
                default: 100,
                min: 0,
            },
            {
                key: "area",
                label: "Catchment area A",
                quantity: "area",
                defaultUnit: "ha",
                default: 2,
                allowedUnits: ["ha", "m2", "acre", "km2"],
                min: 0,
            },
            {
                key: "timeOfConcentration",
                label: "Time of concentration",
                quantity: "time",
                defaultUnit: "min",
                default: 15,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "qM3s",
                label: "Peak runoff Q",
                unit: "m³/s",
                decimals: 4,
                hero: true,
            },
            { key: "qLs", label: "Peak runoff", unit: "L/s", decimals: 1 },
            { key: "areaHa", label: "Catchment area", unit: "ha", decimals: 3 },
            {
                key: "volume",
                label: "Runoff volume over the storm duration",
                unit: "m³",
                decimals: 1,
            },
        ],
        notes: [
            "Runoff coefficients: roofs 0.75–0.95, asphalt 0.70–0.95, lawns 0.10–0.25, bare soil 0.20–0.60.",
            "The rainfall intensity must correspond to a duration equal to the time of concentration.",
            "The method assumes uniform rainfall over the whole catchment.",
        ],
        compute: (v) => {
            const areaHa = v.area / 10000;
            const q = (v.c * v.intensity * areaHa) / 360; // m³/s
            return {
                qM3s: q,
                qLs: q * M3S_TO_LS,
                areaHa,
                volume: q * v.timeOfConcentration, // m³ over the storm duration
            };
        },
    },

    {
        id: "rectangular-weir",
        name: "Rectangular Weir Discharge",
        category: "hydraulics",
        tags: [
            "weir",
            "notch",
            "francis",
            "discharge",
            "flow measurement",
            "irrigation",
        ],
        summary: "Discharge over a rectangular weir using the Francis formula.",
        formula: "Q = 1.84 (L − 0.1 n H) H^1.5",
        reference:
            "Francis formula (SI). Q in m³/s, L and H in metres, n = number of end contractions.",
        inputs: [
            {
                key: "length",
                label: "Crest length L",
                quantity: "length",
                defaultUnit: "m",
                default: 1.5,
                min: 0,
            },
            {
                key: "head",
                label: "Head over the crest H",
                quantity: "length",
                defaultUnit: "m",
                default: 0.25,
                min: 0,
            },
            {
                key: "contractions",
                label: "End contractions",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "None (suppressed)" },
                    { value: 1, label: "One end contracted" },
                    { value: 2, label: "Two ends contracted" },
                ],
            },
        ],
        outputs: [
            {
                key: "qM3s",
                label: "Discharge Q",
                unit: "m³/s",
                decimals: 4,
                hero: true,
            },
            { key: "qLs", label: "Discharge Q", unit: "L/s", decimals: 2 },
            {
                key: "effectiveLength",
                label: "Effective crest length",
                unit: "m",
                decimals: 4,
            },
        ],
        notes: [
            "Valid for H between about 0.05 m and L/3, with free (unsubmerged) flow.",
            "The head must be measured well upstream where the water surface is calm.",
        ],
        compute: (v) => {
            const effectiveLength = Math.max(
                v.length - 0.1 * v.contractions * v.head,
                0,
            );
            const q =
                1.84 * effectiveLength * Math.pow(Math.max(v.head, 0), 1.5);
            return { qM3s: q, qLs: q * M3S_TO_LS, effectiveLength };
        },
    },

    {
        id: "bernoulli-energy",
        name: "Bernoulli Energy Equation",
        category: "hydraulics",
        tags: [
            "bernoulli",
            "energy",
            "total head",
            "pressure head",
            "velocity head",
            "pipeline",
        ],
        summary:
            "Velocity at a downstream section from the Bernoulli energy equation.",
        formula: "H = z + p/γ + v²/2g\nv₂ = √(2g (H₁ − loss − z₂ − p₂/γ))",
        reference:
            "Bernoulli equation for steady, incompressible flow along a streamline.",
        inputs: [
            {
                key: "z1",
                label: "Section 1 — elevation z₁",
                quantity: "length",
                defaultUnit: "m",
                default: 10,
            },
            {
                key: "p1",
                label: "Section 1 — pressure p₁",
                quantity: "pressure",
                defaultUnit: "kPa",
                default: 200,
                min: 0,
            },
            {
                key: "v1",
                label: "Section 1 — velocity v₁",
                quantity: "velocity",
                defaultUnit: "ms",
                default: 1.5,
                min: 0,
            },
            {
                key: "z2",
                label: "Section 2 — elevation z₂",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
            },
            {
                key: "p2",
                label: "Section 2 — pressure p₂",
                quantity: "pressure",
                defaultUnit: "kPa",
                default: 50,
                min: 0,
            },
            {
                key: "gamma",
                label: "Specific weight of the liquid γ",
                quantity: "unitWeight",
                defaultUnit: "kNm3",
                default: 9.81,
                min: 0,
            },
            {
                key: "loss",
                label: "Head loss between the sections",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "v2",
                label: "Velocity at section 2",
                unit: "m/s",
                decimals: 4,
                hero: true,
            },
            {
                key: "h1",
                label: "Total head at section 1",
                unit: "m",
                decimals: 4,
            },
            {
                key: "h2",
                label: "Total head at section 2",
                unit: "m",
                decimals: 4,
            },
            {
                key: "p1Head",
                label: "Pressure head at section 1",
                unit: "m",
                decimals: 4,
            },
            {
                key: "p2Head",
                label: "Pressure head at section 2",
                unit: "m",
                decimals: 4,
            },
        ],
        notes: [
            "The head loss between the sections is subtracted, as it must be for real (viscous) flow.",
            "A zero or negative value inside the square root means the assumed conditions are not physically possible.",
            "Enter both pressures as gauge or both as absolute — do not mix them.",
        ],
        compute: (v) => {
            const p1Head = v.gamma > 0 ? v.p1 / v.gamma : 0;
            const p2Head = v.gamma > 0 ? v.p2 / v.gamma : 0;
            const h1 = v.z1 + p1Head + (v.v1 * v.v1) / (2 * G);
            const available = h1 - v.loss - v.z2 - p2Head;
            const v2 = available > 0 ? Math.sqrt(2 * G * available) : 0;
            const h2 = v.z2 + p2Head + (v2 * v2) / (2 * G);
            return { v2, h1, h2, p1Head, p2Head };
        },
    },

    {
        id: "water-demand",
        name: "Water Demand & Storage",
        category: "hydraulics",
        tags: [
            "water demand",
            "lpcd",
            "population",
            "peak factor",
            "fire demand",
            "storage",
            "water supply",
            "mld",
        ],
        summary:
            "Average and peak water demand, fire flow and balancing storage for a supply scheme.",
        formula:
            "Average demand = population × lpcd\nPeak flow = average × peak factor\nFire demand (Kuichling) = 3182 √P litres/minute\nBalancing storage ≈ one third of the daily demand",
        reference:
            "CPHEEO manual on water supply. Kuichling's formula for fire demand, with P in thousands of population.",
        inputs: [
            {
                key: "population",
                label: "Design population",
                unit: "persons",
                default: 50000,
                min: 0,
                step: 100,
            },
            {
                key: "lpcd",
                label: "Per capita demand",
                unit: "litres/day",
                default: 135,
                min: 0,
                help: "135 lpcd is typical for a town with full flushing",
            },
            {
                key: "peakFactor",
                label: "Peak factor",
                default: 1.5,
                min: 1,
                max: 4,
                step: 0.1,
                help: "1.5 for a town, up to 3 for a small community",
            },
            {
                key: "fireFlow",
                label: "Additional fire flow",
                unit: "litres/s",
                default: 0,
                min: 0,
                help: "Leave at 0 to use Kuichling's formula instead",
            },
            {
                key: "storageFactor",
                label: "Balancing storage as a fraction of the daily demand",
                default: 0.33,
                min: 0.1,
                max: 1,
                step: 0.01,
            },
        ],
        outputs: [
            {
                key: "avgMLD",
                label: "Average daily demand",
                unit: "MLD",
                decimals: 3,
                hero: true,
            },
            { key: "avgFlow", label: "Average flow", unit: "L/s", decimals: 1 },
            { key: "peakFlow", label: "Peak flow", unit: "L/s", decimals: 1 },
            {
                key: "fireFlowUsed",
                label: "Fire flow adopted",
                unit: "L/s",
                decimals: 1,
            },
            {
                key: "designFlow",
                label: "Design flow (peak + fire)",
                unit: "L/s",
                decimals: 1,
            },
            {
                key: "fireLpm",
                label: "Fire demand",
                unit: "litres/min",
                decimals: 0,
            },
            {
                key: "storage",
                label: "Balancing storage",
                unit: "m³",
                decimals: 0,
            },
            {
                key: "annualVolume",
                label: "Annual demand",
                unit: "m³/year",
                decimals: 0,
            },
        ],
        notes: [
            "Kuichling's formula gives about 3182√P litres per minute, where P is the population in thousands.",
            "Fire flow is added to the peak domestic demand for sizing the distribution mains, not for the treatment works.",
            "Balancing storage smooths the difference between a constant supply rate and a varying draw-off. A third of the daily demand is a common rule of thumb.",
            "Add a further allowance for leakage — 15% of the demand is typical for an older network.",
        ],
        compute: (v) => {
            const dailyL = v.population * v.lpcd; // litres/day
            const avgFlow = dailyL / 86400; // L/s
            const peakFlow = avgFlow * v.peakFactor; // L/s

            // Kuichling, with the population expressed in thousands.
            const kuichlingLpm =
                3182 * Math.sqrt(Math.max(v.population / 1000, 0));
            const fireLps = kuichlingLpm / 60;
            const fireFlowUsed = v.fireFlow > 0 ? v.fireFlow : fireLps;

            return {
                avgMLD: dailyL / 1e6,
                avgFlow,
                peakFlow,
                fireFlowUsed,
                designFlow: peakFlow + fireFlowUsed,
                fireLpm: v.fireFlow > 0 ? v.fireFlow * 60 : kuichlingLpm,
                storage: (dailyL * v.storageFactor) / 1000,
                // dailyL is in litres, so convert to cubic metres per year.
                annualVolume: (dailyL * 365) / 1000,
            };
        },
    },

    {
        id: "rainwater-harvesting",
        name: "Rainwater Harvesting Potential",
        category: "hydraulics",
        tags: [
            "rainwater",
            "harvesting",
            "roof",
            "rainfall",
            "storage tank",
            "runoff coefficient",
            "sustainability",
        ],
        summary:
            "Harvestable rainwater from a roof, the share of demand it meets, and a tank size.",
        formula:
            "Harvest = roof area × rainfall × runoff coefficient\nTank capacity = daily demand × number of dry days\nSupply share = annual harvest ÷ annual demand",
        reference:
            "CGWB rainwater harvesting guidance. Runoff coefficient 0.85 for a concrete roof, 0.8 for tiles.",
        inputs: [
            {
                key: "roofArea",
                label: "Roof catchment area",
                quantity: "area",
                defaultUnit: "m2",
                default: 150,
                min: 0,
            },
            {
                key: "rainfall",
                label: "Annual rainfall",
                unit: "mm",
                default: 1200,
                min: 0,
            },
            {
                key: "runoff",
                label: "Runoff coefficient",
                default: 0.85,
                min: 0.5,
                max: 1,
                step: 0.05,
            },
            {
                key: "people",
                label: "Number of users",
                unit: "persons",
                default: 4,
                min: 0,
            },
            {
                key: "lpcd",
                label: "Per capita demand",
                unit: "litres/day",
                default: 135,
                min: 0,
            },
            {
                key: "dryDays",
                label: "Consecutive dry days to cover",
                unit: "days",
                default: 60,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "annualHarvestL",
                label: "Annual harvest",
                unit: "litres",
                decimals: 0,
                hero: true,
            },
            {
                key: "annualHarvestM3",
                label: "Annual harvest",
                unit: "m³",
                decimals: 1,
            },
            {
                key: "dailyHarvest",
                label: "Average daily harvest",
                unit: "litres",
                decimals: 1,
            },
            {
                key: "dailyDemand",
                label: "Daily demand",
                unit: "litres",
                decimals: 0,
            },
            {
                key: "supplyShare",
                label: "Share of the annual demand met",
                unit: "%",
                decimals: 1,
            },
            {
                key: "tankCapacity",
                label: "Suggested tank capacity",
                unit: "litres",
                decimals: 0,
            },
            {
                key: "tankM3",
                label: "Suggested tank capacity",
                unit: "m³",
                decimals: 2,
            },
            {
                key: "dryDaysCovered",
                label: "Dry days the tank covers",
                unit: "days",
                decimals: 1,
            },
        ],
        notes: [
            "Rainfall is unevenly distributed, so the annual harvest does not mean a steady daily supply.",
            "The mass curve of rainfall and demand gives a better tank size than the dry-day rule of thumb.",
            "First-flush diversion (the first 1–2 mm of rain) should be discarded before collection.",
            "Add filtration and chlorination before using harvested water for drinking.",
            "At 1 mm of rain on 1 m² of roof you collect exactly 1 litre — that is the mental arithmetic to remember.",
        ],
        compute: (v) => {
            // 1 mm on 1 m² is 1 litre, so mm × m² gives litres directly.
            const annualHarvestL = v.roofArea * v.rainfall * v.runoff;
            const dailyDemand = v.people * v.lpcd;
            const annualDemand = dailyDemand * 365;
            const tank = dailyDemand * v.dryDays;

            return {
                annualHarvestL,
                annualHarvestM3: annualHarvestL / 1000,
                dailyHarvest: annualHarvestL / 365,
                dailyDemand,
                supplyShare:
                    annualDemand > 0
                        ? (annualHarvestL / annualDemand) * 100
                        : 0,
                tankCapacity: tank,
                tankM3: tank / 1000,
                dryDaysCovered: dailyDemand > 0 ? tank / dailyDemand : 0,
            };
        },
    },

    {
        id: "pump-power",
        name: "Pump Power & Energy Cost",
        category: "hydraulics",
        tags: [
            "pump",
            "power",
            "kw",
            "hp",
            "efficiency",
            "energy",
            "running cost",
            "pumping",
        ],
        summary:
            "Shaft power, motor input and the running cost of a pump from discharge and head.",
        formula:
            "Water power (kW) = ρ g Q H ÷ 1000\nShaft power = water power ÷ pump efficiency\nMotor input = shaft power ÷ motor efficiency",
        reference:
            "Standard pump hydraulics. Efficiency falls sharply away from the duty point of the pump.",
        inputs: [
            {
                key: "discharge",
                label: "Discharge",
                unit: "litres/s",
                default: 10,
                min: 0,
                step: 0.5,
            },
            {
                key: "head",
                label: "Total head (static + friction)",
                quantity: "length",
                defaultUnit: "m",
                default: 30,
                min: 0,
            },
            {
                key: "pumpEff",
                label: "Pump efficiency",
                unit: "%",
                default: 70,
                min: 10,
                max: 95,
            },
            {
                key: "motorEff",
                label: "Motor efficiency",
                unit: "%",
                default: 90,
                min: 10,
                max: 100,
            },
            {
                key: "hoursPerDay",
                label: "Running hours per day",
                unit: "hours",
                default: 8,
                min: 0,
                max: 24,
                step: 0.5,
            },
            {
                key: "tariff",
                label: "Electricity tariff",
                unit: "per kWh",
                default: 8,
                min: 0,
                step: 0.5,
            },
        ],
        outputs: [
            {
                key: "motorInput",
                label: "Motor input power",
                unit: "kW",
                decimals: 2,
                hero: true,
            },
            {
                key: "shaftPower",
                label: "Pump shaft power",
                unit: "kW",
                decimals: 2,
            },
            {
                key: "waterPower",
                label: "Water power",
                unit: "kW",
                decimals: 2,
            },
            { key: "motorHp", label: "Motor rating", unit: "hp", decimals: 2 },
            {
                key: "energyPerDay",
                label: "Energy per day",
                unit: "kWh",
                decimals: 2,
            },
            {
                key: "volumePerDay",
                label: "Water pumped per day",
                unit: "m³",
                decimals: 1,
            },
            {
                key: "specificEnergy",
                label: "Specific energy",
                unit: "kWh per m³",
                decimals: 4,
            },
            { key: "dailyCost", label: "Daily energy cost", decimals: 2 },
            { key: "annualCost", label: "Annual energy cost", decimals: 0 },
        ],
        notes: [
            "Size the motor above the computed input power — a service factor of 1.15 or more is normal.",
            "Total head must include the static lift, friction losses in the pipe and fittings, and the delivery velocity head.",
            "Specific energy (kWh per m³) is the fairest way to compare pumping options or spot a worn impeller.",
            "Energy typically dominates the lifecycle cost of a pump far more than the purchase price.",
        ],
        compute: (v) => {
            const q = v.discharge / 1000; // m³/s
            const waterKW = (1000 * G * q * v.head) / 1000; // kW
            const shaftKW = waterKW / Math.max(v.pumpEff / 100, 0.01);
            const inputKW = shaftKW / Math.max(v.motorEff / 100, 0.01);

            const energyPerDay = inputKW * v.hoursPerDay;
            const volumePerDay = q * 3600 * v.hoursPerDay; // m³

            return {
                motorInput: inputKW,
                shaftPower: shaftKW,
                waterPower: waterKW,
                motorHp: inputKW / 0.7457,
                energyPerDay,
                volumePerDay,
                specificEnergy:
                    volumePerDay > 0 ? energyPerDay / volumePerDay : 0,
                dailyCost: energyPerDay * v.tariff,
                annualCost: energyPerDay * v.tariff * 365,
            };
        },
    },
];
