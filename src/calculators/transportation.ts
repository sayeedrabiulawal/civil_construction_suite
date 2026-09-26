import type { Calculator } from "@/core/types";
import { trafficGrowthChart } from "./charts";

/**
 * Transportation calculators.
 *
 * Inputs arrive in SI base units: speeds in m/s, lengths in m, angles in radians.
 * Highway results are reported in km/h-based percentages and degrees, so `compute`
 * converts those explicitly.
 */
const MS_TO_KMH = 3.6;
const RAD_TO_DEG = 180 / Math.PI;

export const TRANSPORTATION_CALCULATORS: Calculator[] = [
    {
        id: "superelevation",
        name: "Superelevation (Banking)",
        category: "transportation",
        tags: [
            "superelevation",
            "banking",
            "cant",
            "road",
            "curve",
            "highway",
            "irc",
        ],
        summary:
            "Required superelevation on a horizontal curve for a design speed.",
        formula:
            "e = V² / (127 R) − f\nSuperelevation ignoring friction: e = V² / (225 R)",
        reference:
            "IRC 38 / IRC 73. V in km/h, R in metres. Maximum e = 7% (plain), 10% (hilly, with friction).",
        inputs: [
            {
                key: "speed",
                label: "Design speed V",
                quantity: "velocity",
                defaultUnit: "kmh",
                default: 65,
                min: 0,
            },
            {
                key: "radius",
                label: "Curve radius R",
                quantity: "length",
                defaultUnit: "m",
                default: 200,
                min: 0,
            },
            {
                key: "friction",
                label: "Lateral friction factor f",
                default: 0.15,
                min: 0,
                max: 0.3,
                step: 0.01,
                help: "Typical 0.15 at 65 km/h",
            },
            {
                key: "terrain",
                label: "Terrain",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "Plain / rolling (max 7%)" },
                    { value: 1, label: "Hilly, not snow bound (max 10%)" },
                    { value: 2, label: "Hilly, snow bound (max 7%)" },
                ],
            },
        ],
        outputs: [
            {
                key: "e",
                label: "Required superelevation",
                unit: "%",
                decimals: 3,
                hero: true,
            },
            {
                key: "eDesign",
                label: "Superelevation ignoring friction",
                unit: "%",
                decimals: 3,
            },
            { key: "maxE", label: "Maximum permitted", unit: "%", decimals: 1 },
            {
                key: "eFraction",
                label: "Superelevation as a fraction",
                decimals: 5,
            },
            { key: "status", label: "Check against the maximum" },
        ],
        notes: [
            "The friction term only helps once the superelevation limit is reached — never rely on it for a first design.",
            "Provide a minimum superelevation of 2.5% for drainage wherever the curve is flatter than the camber.",
            "A transition (spiral) curve must be introduced to develop the superelevation gradually.",
        ],
        compute: (v) => {
            const speedKmh = v.speed * MS_TO_KMH;
            const maxE = v.terrain === 1 ? 10 : 7;
            const e =
                v.radius > 0
                    ? (speedKmh * speedKmh) / (127 * v.radius) - v.friction
                    : 0;
            const eDesign =
                v.radius > 0 ? (speedKmh * speedKmh) / (225 * v.radius) : 0;
            const ePercent = e * 100;

            return {
                e: ePercent,
                eDesign: eDesign * 100,
                maxE,
                eFraction: e,
                status:
                    ePercent > maxE
                        ? "EXCEEDS LIMIT — increase the radius or reduce the design speed"
                        : "Within the permitted limit",
            };
        },
    },

    {
        id: "stopping-sight-distance",
        name: "Stopping Sight Distance",
        category: "transportation",
        tags: [
            "sight distance",
            "ssd",
            "stopping",
            "braking",
            "reaction time",
            "highway safety",
            "irc",
        ],
        summary:
            "Safe stopping distance for a design speed, reaction time and gradient.",
        formula: "SSD = 0.278 V t + V² / (254 (f + 0.01 n))",
        reference:
            "IRC 66. V in km/h, t in seconds, f the longitudinal friction, n the gradient in % (positive uphill).",
        inputs: [
            {
                key: "speed",
                label: "Design speed V",
                quantity: "velocity",
                defaultUnit: "kmh",
                default: 80,
                min: 0,
            },
            {
                key: "reaction",
                label: "Reaction time t",
                quantity: "time",
                defaultUnit: "s",
                default: 2.5,
                min: 0,
            },
            {
                key: "friction",
                label: "Longitudinal friction coefficient f",
                default: 0.36,
                min: 0.1,
                max: 0.6,
                step: 0.01,
            },
            {
                key: "gradient",
                label: "Gradient n",
                unit: "%",
                default: 0,
                min: -10,
                max: 10,
                step: 0.5,
                help: "Positive uphill, negative downhill",
            },
        ],
        outputs: [
            {
                key: "ssd",
                label: "Stopping sight distance",
                unit: "m",
                decimals: 2,
                hero: true,
            },
            {
                key: "reactionDistance",
                label: "Lag (reaction) distance",
                unit: "m",
                decimals: 2,
            },
            {
                key: "brakingDistance",
                label: "Braking distance",
                unit: "m",
                decimals: 2,
            },
        ],
        notes: [
            "An uphill gradient assists braking and shortens the distance; a downhill gradient lengthens it.",
            "A reaction time of 2.5 s is the IRC value for a normal driver; use 2.0 s only for experienced drivers.",
            "Overtaking (OSD) and intermediate (ISD) sight distances must also be checked on undivided roads.",
        ],
        compute: (v) => {
            const speedKmh = v.speed * MS_TO_KMH;
            const reactionDistance = 0.278 * speedKmh * v.reaction;
            const denominator = 254 * (v.friction + 0.01 * v.gradient);
            const brakingDistance =
                denominator > 0 ? (speedKmh * speedKmh) / denominator : 0;
            return {
                ssd: reactionDistance + brakingDistance,
                reactionDistance,
                brakingDistance,
            };
        },
    },

    {
        id: "horizontal-curve",
        name: "Horizontal Curve Geometry",
        category: "transportation",
        tags: [
            "horizontal curve",
            "radius",
            "deflection angle",
            "tangent",
            "length",
            "chord",
            "road",
        ],
        summary:
            "Tangent length, curve length, chord and mid-ordinate of a simple circular curve.",
        formula:
            "T = R tan(Δ/2)\nL = π R Δ / 180\nLong chord = 2 R sin(Δ/2)\nMid-ordinate = R (1 − cos(Δ/2))",
        reference: "Simple circular curve geometry. R in metres, Δ in degrees.",
        inputs: [
            {
                key: "radius",
                label: "Curve radius R",
                quantity: "length",
                defaultUnit: "m",
                default: 300,
                min: 0,
            },
            {
                key: "angle",
                label: "Deflection angle Δ",
                quantity: "angle",
                defaultUnit: "deg",
                default: 40,
            },
            {
                key: "chainage",
                label: "Chainage of the intersection point",
                quantity: "length",
                defaultUnit: "m",
                default: 1500,
            },
        ],
        outputs: [
            {
                key: "length",
                label: "Length of the curve L",
                unit: "m",
                decimals: 3,
                hero: true,
            },
            {
                key: "tangent",
                label: "Tangent length T",
                unit: "m",
                decimals: 3,
            },
            { key: "chord", label: "Long chord", unit: "m", decimals: 3 },
            {
                key: "midOrdinate",
                label: "Mid-ordinate",
                unit: "m",
                decimals: 3,
            },
            {
                key: "externalDistance",
                label: "External distance",
                unit: "m",
                decimals: 3,
            },
            {
                key: "startPoint",
                label: "Chainage of the curve start",
                unit: "m",
                decimals: 3,
            },
            {
                key: "endPoint",
                label: "Chainage of the curve end",
                unit: "m",
                decimals: 3,
            },
        ],
        notes: [
            "Chainages are measured along the route, not in a straight line.",
            "For a compound or transitioned curve, split the work into the spiral and circular portions.",
        ],
        compute: (v) => {
            const half = v.angle / 2; // radians
            const tangent = v.radius * Math.tan(half);
            const length = Math.PI * v.radius * ((v.angle * RAD_TO_DEG) / 180);
            const chord = 2 * v.radius * Math.sin(half);
            const midOrdinate = v.radius * (1 - Math.cos(half));
            const externalDistance = v.radius * (1 / Math.cos(half) - 1);
            return {
                length,
                tangent,
                chord,
                midOrdinate,
                externalDistance,
                startPoint: v.chainage - tangent,
                endPoint: v.chainage - tangent + length,
            };
        },
    },

    {
        id: "cbr-value",
        name: "California Bearing Ratio (CBR)",
        category: "transportation",
        tags: [
            "cbr",
            "bearing ratio",
            "pavement",
            "subgrade",
            "soaked",
            "penetration",
            "irc 37",
        ],
        summary:
            "CBR value from the test load and standard load at a given penetration.",
        formula: "CBR = (Test load ÷ Standard load) × 100",
        reference:
            "IS 2720 (Part 16). Standard loads: 13.44 kN at 2.5 mm, 20.16 kN at 5.0 mm.",
        inputs: [
            {
                key: "testLoad",
                label: "Test load at the penetration",
                quantity: "force",
                defaultUnit: "kN",
                default: 5,
                min: 0,
            },
            {
                key: "penetration",
                label: "Penetration",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "2.5 mm (standard load 13.44 kN)" },
                    { value: 1, label: "5.0 mm (standard load 20.16 kN)" },
                ],
            },
        ],
        outputs: [
            {
                key: "cbr",
                label: "CBR value",
                unit: "%",
                decimals: 2,
                hero: true,
            },
            {
                key: "standardLoad",
                label: "Standard load used",
                unit: "kN",
                decimals: 2,
            },
            { key: "subgradeQuality", label: "Subgrade quality" },
        ],
        notes: [
            "The CBR is normally taken at 2.5 mm penetration. If the 5.0 mm value is higher, repeat the test.",
            "Soaking for 96 hours gives the soaked CBR, which is what design should use in wet climates.",
            "Typical values: soft clay below 3%, silt 4–8%, sand 8–20%, gravel 20–40%.",
            "IRC 37 gives the pavement thickness for a design traffic and subgrade CBR — use that chart for layer design.",
        ],
        compute: (v) => {
            const standardKN = v.penetration === 0 ? 13.44 : 20.16;
            const standardN = standardKN * 1000;
            const cbr = standardN > 0 ? (v.testLoad / standardN) * 100 : 0;

            let subgradeQuality: string;
            if (cbr < 3)
                subgradeQuality =
                    "Very poor — needs a thick pavement or subgrade replacement";
            else if (cbr < 5) subgradeQuality = "Poor";
            else if (cbr < 8) subgradeQuality = "Fair";
            else if (cbr < 15) subgradeQuality = "Good";
            else subgradeQuality = "Very good";

            return { cbr, standardLoad: standardKN, subgradeQuality };
        },
    },

    {
        id: "road-gradient",
        name: "Road Gradient Calculator",
        category: "transportation",
        tags: [
            "gradient",
            "slope",
            "rise",
            "fall",
            "road",
            "incline",
            "percentage",
        ],
        summary: "Gradient, rise or run for a road or drainage line.",
        formula: "Gradient % = (Rise ÷ Run) × 100   |   1 in X = Run ÷ Rise",
        reference:
            "IRC limits; the ruling gradient should not exceed about 1 in 30 (3.3%) on a national highway.",
        inputs: [
            {
                key: "rise",
                label: "Vertical rise (or fall)",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "run",
                label: "Horizontal distance",
                quantity: "length",
                defaultUnit: "m",
                default: 150,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "gradient",
                label: "Gradient",
                unit: "%",
                decimals: 3,
                hero: true,
            },
            { key: "oneIn", label: 'Gradient as "1 in X"', decimals: 2 },
            {
                key: "angle",
                label: "Inclination angle",
                unit: "°",
                decimals: 3,
            },
            {
                key: "slopeLength",
                label: "Length along the slope",
                unit: "m",
                decimals: 3,
            },
        ],
        compute: (v) => {
            const gradient = v.run > 0 ? (v.rise / v.run) * 100 : 0;
            return {
                gradient,
                oneIn: v.rise > 0 ? v.run / v.rise : 0,
                angle: (Math.atan2(v.rise, v.run) * 180) / Math.PI,
                slopeLength: Math.hypot(v.rise, v.run),
            };
        },
    },

    {
        id: "pavement-layer-quantity",
        name: "Pavement Layer Quantity",
        category: "transportation",
        tags: [
            "pavement",
            "road",
            "gsb",
            "wmm",
            "dbm",
            "bc",
            "layer",
            "quantity",
            "boq",
        ],
        summary:
            "Volume and tonnage of a pavement layer such as GSB, WMM, DBM or BC.",
        formula:
            "Volume = Length × Width × Thickness\nTonnage = Volume × Density ÷ 1000",
        inputs: [
            {
                key: "length",
                label: "Road length",
                quantity: "length",
                defaultUnit: "m",
                default: 1000,
                min: 0,
            },
            {
                key: "width",
                label: "Carriageway width",
                quantity: "length",
                defaultUnit: "m",
                default: 7,
                min: 0,
            },
            {
                key: "thickness",
                label: "Layer thickness",
                quantity: "length",
                defaultUnit: "mm",
                default: 100,
                allowedUnits: ["mm", "cm", "m", "in"],
                min: 0,
            },
            {
                key: "material",
                label: "Layer material",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "GSB / WMM (2.10 t/m³)" },
                    { value: 1, label: "DBM / BC (2.40 t/m³)" },
                    { value: 2, label: "Soil / gravel fill (1.80 t/m³)" },
                    { value: 3, label: "Custom" },
                ],
            },
            {
                key: "customDensity",
                label: "Custom density",
                unit: "kg/m³",
                default: 2200,
                min: 0,
                help: "Used only when Custom is selected",
            },
            {
                key: "allowance",
                label: "Compaction / wastage allowance",
                unit: "%",
                default: 5,
                min: 0,
                max: 30,
            },
        ],
        outputs: [
            {
                key: "volume",
                label: "Loose volume required",
                unit: "m³",
                decimals: 2,
                hero: true,
            },
            {
                key: "netVolume",
                label: "Compacted (net) volume",
                unit: "m³",
                decimals: 2,
            },
            {
                key: "tonnage",
                label: "Tonnage required",
                unit: "tonne",
                decimals: 2,
            },
            { key: "area", label: "Layer area", unit: "m²", decimals: 1 },
            {
                key: "truckLoads",
                label: "Truck loads (16 t each)",
                decimals: 0,
            },
        ],
        notes: [
            "Densities are indicative — use the job-mix or laboratory value whenever available.",
            "The allowance covers compaction shrinkage and haulage losses.",
        ],
        compute: (v) => {
            const densities = [2100, 2400, 1800, v.customDensity];
            const density = densities[v.material];

            const area = v.length * v.width;
            const netVolume = area * v.thickness;
            const looseVolume = netVolume * (1 + v.allowance / 100);
            const tonnage = (netVolume * density) / 1000;

            return {
                volume: looseVolume,
                netVolume,
                tonnage,
                area,
                truckLoads: Math.ceil(tonnage / 16),
            };
        },
    },

    {
        id: "design-traffic-msa",
        name: "Design Traffic (Cumulative MSA)",
        category: "transportation",
        tags: [
            "msa",
            "million standard axles",
            "design traffic",
            "cvpd",
            "vdf",
            "irc 37",
            "pavement design",
            "growth rate",
        ],
        summary:
            "Cumulative million standard axles for pavement design, from the initial commercial traffic.",
        formula:
            "N = 365 A [ (1 + r)ⁿ − 1 ] ÷ r × D × F ÷ 10⁶\nA = initial commercial vehicles per day, D = lane distribution factor, F = vehicle damage factor",
        reference:
            "IRC 37. Lane distribution factors follow Table 3 and the vehicle damage factor Table 4 of that code.",
        inputs: [
            {
                key: "cvpd",
                label: "Initial commercial vehicles per day (both directions)",
                unit: "CVPD",
                default: 2000,
                min: 0,
                step: 50,
            },
            {
                key: "growth",
                label: "Annual traffic growth rate",
                unit: "%",
                default: 7.5,
                min: 0,
                max: 15,
                step: 0.5,
            },
            {
                key: "life",
                label: "Design life",
                unit: "years",
                default: 15,
                min: 1,
                max: 30,
                step: 1,
            },
            {
                key: "vdf",
                label: "Vehicle damage factor F",
                default: 4.5,
                min: 0.5,
                max: 10,
                step: 0.1,
                help: "IRC 37 Table 4: 4.5 for a rolling terrain with a high truck proportion",
            },
            {
                key: "lanes",
                label: "Carriageway configuration",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Single lane — D = 1.00" },
                    {
                        value: 1,
                        label: "Two lanes, single carriageway — D = 0.75",
                    },
                    { value: 2, label: "Four lanes and above — D = 0.40" },
                ],
            },
        ],
        outputs: [
            {
                key: "msa",
                label: "Cumulative design traffic",
                unit: "million standard axles",
                decimals: 2,
                hero: true,
            },
            {
                key: "laneFactor",
                label: "Lane distribution factor D",
                decimals: 2,
            },
            {
                key: "trafficAtEnd",
                label: "Commercial vehicles per day in the final year",
                unit: "CVPD",
                decimals: 0,
            },
            {
                key: "totalVehicles",
                label: "Total commercial vehicles over the design life",
                decimals: 0,
            },
            {
                key: "standardAxles",
                label: "Total standard axles",
                decimals: 0,
            },
            { key: "category", label: "Pavement design category" },
        ],
        notes: [
            "The result is the traffic in the DESIGN lane, which is what pavement thickness is based on.",
            "Confirm the lane distribution factor against IRC 37 Table 3 for your carriageway configuration.",
            "The vehicle damage factor should be measured at a weighbridge. It has more influence on the answer than any other input.",
            "Inputs are clamped to the ranges the code covers: growth 0–15%, design life 1–30 years, VDF 0.5–10.",
            "For design lives above 30 years, or where the growth rate is uncertain, carry out a sensitivity check.",
            "Very light traffic (below 2 MSA) may be designed as a low-volume road instead.",
        ],
        compute: (v) => {
            // Clamp to the ranges IRC 37 covers, so an impossible entry cannot
            // produce an infinite or meaningless traffic figure.
            const r = Math.min(Math.max(v.growth, 0), 15) / 100;
            const n = Math.min(Math.max(v.life, 1), 30);
            const vdf = Math.min(Math.max(v.vdf, 0.5), 10);
            const cvpd = Math.max(v.cvpd, 0);
            const d = [1.0, 0.75, 0.4][v.lanes];

            // Cumulative number of commercial vehicles over the design life.
            const cumulative =
                r > 0
                    ? (365 * cvpd * (Math.pow(1 + r, n) - 1)) / r
                    : 365 * cvpd * n;

            const standardAxles = cumulative * d * vdf;
            const msa = standardAxles / 1e6;

            let category: string;
            if (msa < 2)
                category = "Very light — consider a low-volume road design";
            else if (msa < 10) category = "Light (2–10 MSA)";
            else if (msa < 30) category = "Medium (10–30 MSA)";
            else if (msa < 100) category = "Heavy (30–100 MSA)";
            else
                category =
                    "Very heavy (above 100 MSA) — check the subgrade carefully";

            return {
                msa,
                laneFactor: d,
                trafficAtEnd: cvpd * Math.pow(1 + r, n),
                totalVehicles: cumulative * d,
                standardAxles,
                category,
            };
        },
        chart: (v) =>
            trafficGrowthChart({
                cvpd: Math.max(v.cvpd, 0),
                growthRatePct: v.growth,
                lanes: v.lanes,
                vdf: v.vdf,
                life: Math.min(Math.max(Math.round(v.life), 1), 30),
            }),
    },

    {
        id: "overtaking-sight-distance",
        name: "Overtaking Sight Distance",
        category: "transportation",
        tags: [
            "osd",
            "overtaking sight distance",
            "sight distance",
            "highway safety",
            "irc 66",
            "two lane road",
        ],
        summary:
            "Safe overtaking sight distance for a two-lane undivided road.",
        formula:
            "d₁ = 0.278 V t₁   (reaction before pulling out)\nd₂ = 0.278 V T    (travel while overtaking)\nd₃ = clearance after returning\nOSD = d₁ + d₂ + d₃",
        reference:
            "IRC 66. V is in km/h. Reaction time is normally 2 s and the overtaking manoeuvre 9–10 s.",
        inputs: [
            {
                key: "speed",
                label: "Design speed of the overtaking vehicle V",
                quantity: "velocity",
                defaultUnit: "kmh",
                default: 80,
                min: 0,
            },
            {
                key: "reactionTime",
                label: "Reaction time before overtaking t₁",
                unit: "seconds",
                default: 2,
                min: 0.5,
                max: 5,
                step: 0.5,
            },
            {
                key: "overtakingTime",
                label: "Overtaking manoeuvre time T",
                unit: "seconds",
                default: 10,
                min: 3,
                max: 20,
                step: 0.5,
                help: "IRC 66 uses about 9–10 s",
            },
            {
                key: "clearance",
                label: "Clearance distance d₃ after returning",
                unit: "m",
                default: 5,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "osd",
                label: "Overtaking sight distance",
                unit: "m",
                decimals: 1,
                hero: true,
            },
            {
                key: "d1",
                label: "d₁ — reaction distance",
                unit: "m",
                decimals: 1,
            },
            {
                key: "d2",
                label: "d₂ — overtaking travel",
                unit: "m",
                decimals: 1,
            },
            { key: "d3", label: "d₃ — clearance", unit: "m", decimals: 1 },
            {
                key: "ssd",
                label: "Stopping sight distance for comparison",
                unit: "m",
                decimals: 1,
            },
            { key: "designAdvice", label: "Design implication" },
        ],
        notes: [
            "OSD must exceed SSD — it is always the larger of the two.",
            "Where OSD cannot be provided, overtaking must be prohibited: use a solid centre line and no-overtaking signage.",
            "Intermediate sight distance (ISD) is about twice the SSD and is used for divided highways and for design of valley curves.",
            "The overtaking manoeuvre time increases on steep upgrades, so OSD must be increased on grades.",
        ],
        compute: (v) => {
            const speedKmh = v.speed * MS_TO_KMH;
            const d1 = 0.278 * speedKmh * v.reactionTime;
            const d2 = 0.278 * speedKmh * v.overtakingTime;
            const d3 = v.clearance;
            const osd = d1 + d2 + d3;

            // SSD with a typical reaction time and friction factor, for comparison.
            const ssd =
                0.278 * speedKmh * 2.5 + (speedKmh * speedKmh) / (254 * 0.36);

            let designAdvice: string;
            if (osd >= 500)
                designAdvice =
                    "Very long sight distance needed — overtaking is only realistic on straight, flat sections";
            else if (osd >= 300)
                designAdvice = "Typical requirement for a national highway";
            else designAdvice = "Achievable on most alignments";

            return { osd, d1, d2, d3, ssd, designAdvice };
        },
    },

    {
        id: "vertical-curve",
        name: "Vertical Curve Length",
        category: "transportation",
        tags: [
            "vertical curve",
            "summit curve",
            "valley curve",
            "crest",
            "gradient change",
            "sight distance",
            "irc 73",
        ],
        summary:
            "Minimum length of a summit or valley vertical curve from the sight distance requirement.",
        formula:
            "Summit:  L = n S² ÷ 2(√H + √h)²   for S < L,  else L = 2S − 2(√H + √h)² ÷ n\nValley:  L = n S² ÷ (2h + 2S tan α)  for S < L,  else L = 2S − (2h + 2S tan α) ÷ n\nn = |g₂ − g₁| as a fraction",
        reference:
            "IRC 73 / IRC 66. Summit curve uses H = 1.2 m eye height and h = 0.15 m object height; valley curve uses a 0.75 m headlight height and a 1° beam.",
        inputs: [
            {
                key: "g1",
                label: "Entry gradient g₁",
                unit: "%",
                default: 2,
                min: -15,
                max: 15,
                step: 0.1,
                help: "Positive uphill, negative downhill",
            },
            {
                key: "g2",
                label: "Exit gradient g₂",
                unit: "%",
                default: -1,
                min: -15,
                max: 15,
                step: 0.1,
            },
            {
                key: "speed",
                label: "Design speed",
                quantity: "velocity",
                defaultUnit: "kmh",
                default: 80,
                min: 0,
            },
            {
                key: "type",
                label: "Curve type",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "Summit (crest) — sight over the hill" },
                    {
                        value: 1,
                        label: "Valley (sag) — headlight sight distance",
                    },
                ],
            },
            {
                key: "friction",
                label: "Longitudinal friction for the SSD",
                default: 0.36,
                min: 0.1,
                max: 0.6,
                step: 0.01,
            },
            {
                key: "reactionTime",
                label: "Reaction time for the SSD",
                unit: "seconds",
                default: 2.5,
                min: 1,
                max: 4,
                step: 0.5,
            },
        ],
        outputs: [
            {
                key: "length",
                label: "Minimum curve length",
                unit: "m",
                decimals: 1,
                hero: true,
            },
            {
                key: "sightDistance",
                label: "Sight distance used",
                unit: "m",
                decimals: 1,
            },
            {
                key: "algebraicChange",
                label: "Algebraic change of gradient n",
                unit: "%",
                decimals: 2,
            },
            {
                key: "rateOfChange",
                label: "Rate of change of gradient",
                unit: "% per 100 m",
                decimals: 4,
            },
            { key: "curveType", label: "Curve type" },
            { key: "caseUsed", label: "Formula case applied" },
        ],
        notes: [
            "Gradients are signed: a summit curve occurs when a rising gradient meets a falling one, so g₁ − g₂ is positive but n is taken as the absolute value.",
            "The length is calculated by whichever of the two cases applies. The calculator tests S < L first and switches automatically.",
            "Also check the comfort criterion and the minimum length of 0.6 V for a valley curve, and provide drainage at the low point.",
            "A headlight sight distance requirement almost always governs the design of a valley curve.",
        ],
        compute: (v) => {
            const n = Math.abs(v.g2 - v.g1) / 100; // fraction
            const speedKmh = v.speed * MS_TO_KMH;

            // Zero friction would make the braking distance infinite. Clamp to the
            // lowest value the model is valid for rather than reporting infinity.
            const friction = Math.max(v.friction, 0.1);

            const sightDistance =
                0.278 * speedKmh * v.reactionTime +
                (speedKmh * speedKmh) / (254 * friction);

            let length: number;
            let caseUsed: string;

            if (v.type === 0) {
                // Summit: driver eye 1.2 m, object 0.15 m above the road.
                const a = 2 * (Math.sqrt(1.2) + Math.sqrt(0.15)) ** 2;
                const l1 = n > 0 ? (n * sightDistance * sightDistance) / a : 0;
                if (l1 >= sightDistance) {
                    length = l1;
                    caseUsed = "S < L — sight distance lies within the curve";
                } else {
                    length =
                        n > 0 ? 2 * sightDistance - a / n : 2 * sightDistance;
                    caseUsed =
                        "S > L — the curve is shorter than the sight distance";
                }
            } else {
                // Valley: headlight 0.75 m high, beam inclined at 1°.
                const b =
                    2 * 0.75 +
                    2 * sightDistance * Math.tan((1 * Math.PI) / 180);
                const l1 = n > 0 ? (n * sightDistance * sightDistance) / b : 0;
                if (l1 >= sightDistance) {
                    length = l1;
                    caseUsed =
                        "S < L — headlight sight distance lies within the curve";
                } else {
                    length =
                        n > 0 ? 2 * sightDistance - b / n : 2 * sightDistance;
                    caseUsed =
                        "S > L — the curve is shorter than the sight distance";
                }
            }

            return {
                length: Math.max(length, 0),
                sightDistance,
                algebraicChange: n * 100,
                rateOfChange: length > 0 ? (n * 100 * 100) / length : 0,
                curveType: v.type === 0 ? "Summit (crest)" : "Valley (sag)",
                caseUsed,
            };
        },
    },
];
