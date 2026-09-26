import type { Calculator } from "@/core/types";

/**
 * Surveying calculators.
 *
 * Inputs arrive in SI base units: lengths in m, areas in m², temperatures in °C,
 * angles in radians. Correction outputs are converted to millimetres and degrees
 * inside `compute`, because outputs are shown exactly as returned.
 */
const FT2_PER_M2 = 1 / 0.09290304;

export const SURVEYING_CALCULATORS: Calculator[] = [
    {
        id: "area-by-coordinates",
        name: "Area by Coordinates (Shoelace)",
        category: "surveying",
        tags: [
            "area",
            "coordinates",
            "shoelace",
            "plot",
            "land",
            "traverse",
            "polygon",
        ],
        summary: "Area of a plot from the coordinates of its corners.",
        formula: "Area = ½ |Σ (xᵢ · yᵢ₊₁ − xᵢ₊₁ · yᵢ)|",
        reference:
            "The shoelace (surveyor's) formula. The polygon closes automatically.",
        inputs: [
            {
                key: "corners",
                label: "Number of corners in the plot",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "3 (triangle)" },
                    { value: 1, label: "4 (quadrilateral)" },
                    { value: 2, label: "5 (pentagon)" },
                    { value: 3, label: "6 (hexagon)" },
                ],
            },
            {
                key: "x1",
                label: "Point 1 — x (easting)",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
            },
            {
                key: "y1",
                label: "Point 1 — y (northing)",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
            },
            {
                key: "x2",
                label: "Point 2 — x",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
            },
            {
                key: "y2",
                label: "Point 2 — y",
                quantity: "length",
                defaultUnit: "m",
                default: 10,
            },
            {
                key: "x3",
                label: "Point 3 — x",
                quantity: "length",
                defaultUnit: "m",
                default: 20,
            },
            {
                key: "y3",
                label: "Point 3 — y",
                quantity: "length",
                defaultUnit: "m",
                default: 10,
            },
            {
                key: "x4",
                label: "Point 4 — x",
                quantity: "length",
                defaultUnit: "m",
                default: 20,
            },
            {
                key: "y4",
                label: "Point 4 — y",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
            },
            {
                key: "x5",
                label: "Point 5 — x",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
            },
            {
                key: "y5",
                label: "Point 5 — y",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
            },
            {
                key: "x6",
                label: "Point 6 — x",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
            },
            {
                key: "y6",
                label: "Point 6 — y",
                quantity: "length",
                defaultUnit: "m",
                default: 0,
            },
        ],
        outputs: [
            { key: "area", label: "Area", unit: "m²", decimals: 3, hero: true },
            { key: "areaFt", label: "Area", unit: "ft²", decimals: 1 },
            { key: "perimeter", label: "Perimeter", unit: "m", decimals: 3 },
            {
                key: "pointsUsed",
                label: "Corners used",
                unit: "nos",
                decimals: 0,
            },
        ],
        notes: [
            "Set the number of corners first — any point fields beyond that count are ignored.",
            "A corner may sit at (0, 0); that is a perfectly valid coordinate.",
            "List the points in order around the boundary, clockwise or anticlockwise. Do not zig-zag.",
            "A self-intersecting outline gives a meaningless result.",
        ],
        compute: (v) => {
            const all: [number, number][] = [
                [v.x1, v.y1],
                [v.x2, v.y2],
                [v.x3, v.y3],
                [v.x4, v.y4],
                [v.x5, v.y5],
                [v.x6, v.y6],
            ];

            const cornerCount = v.corners + 3; // select index -> 3..6
            const pts = all.slice(0, cornerCount);

            let twiceArea = 0;
            let perimeter = 0;
            for (let i = 0; i < pts.length; i += 1) {
                const [x1, y1] = pts[i];
                const [x2, y2] = pts[(i + 1) % pts.length];
                twiceArea += x1 * y2 - x2 * y1;
                perimeter += Math.hypot(x2 - x1, y2 - y1);
            }

            const area = Math.abs(twiceArea) / 2;
            return {
                area,
                areaFt: area * FT2_PER_M2,
                perimeter,
                pointsUsed: cornerCount,
            };
        },
    },

    {
        id: "levelling-hi-method",
        name: "Levelling — Height of Instrument",
        category: "surveying",
        tags: [
            "levelling",
            "level",
            "height of instrument",
            "hi",
            "rl",
            "backsight",
            "foresight",
            "dumpy",
        ],
        summary:
            "Reduced level of a point from a benchmark using the height of instrument method.",
        formula:
            "HI = RL of benchmark + Backsight\nRL of point = HI − Foresight",
        reference:
            "Standard level-book reduction — the HI (collimation) method.",
        inputs: [
            {
                key: "bm",
                label: "RL of benchmark",
                quantity: "length",
                defaultUnit: "m",
                default: 100,
            },
            {
                key: "bs",
                label: "Backsight (staff reading on the benchmark)",
                quantity: "length",
                defaultUnit: "m",
                default: 1.465,
            },
            {
                key: "fs",
                label: "Foresight (staff reading on the point)",
                quantity: "length",
                defaultUnit: "m",
                default: 1.875,
            },
        ],
        outputs: [
            {
                key: "rl",
                label: "RL of the point",
                unit: "m",
                decimals: 3,
                hero: true,
            },
            {
                key: "hi",
                label: "Height of instrument",
                unit: "m",
                decimals: 3,
            },
            {
                key: "difference",
                label: "Difference in level from the benchmark",
                unit: "m",
                decimals: 3,
            },
        ],
        notes: [
            "A negative difference means the new point is higher than the benchmark.",
            "For a long line, repeat the calculation from each instrument station, carrying the RL forward.",
            "Always close the level run on a known benchmark to check the misclosure.",
        ],
        compute: (v) => {
            const hi = v.bm + v.bs;
            return { rl: hi - v.fs, hi, difference: hi - v.fs - v.bm };
        },
    },

    {
        id: "tape-correction-temperature",
        name: "Tape Correction — Temperature",
        category: "surveying",
        tags: [
            "tape",
            "correction",
            "temperature",
            "chain",
            "linear measurement",
            "thermal",
        ],
        summary:
            "Correction to a measured length for a tape used at a temperature other than standard.",
        formula: "Ct = L × α × (Tm − To)\nCorrect length = L + Ct",
        reference:
            "α for steel ≈ 11.7 × 10⁻⁶ per °C. Standard temperature is usually 20 °C.",
        inputs: [
            {
                key: "length",
                label: "Measured length L",
                quantity: "length",
                defaultUnit: "m",
                default: 100,
                min: 0,
            },
            {
                key: "alpha",
                label: "Coefficient of thermal expansion α",
                unit: "×10⁻⁶/°C",
                default: 11.7,
                min: 0,
                step: 0.1,
                help: "11.7 for steel, 17 for invar",
            },
            {
                key: "tm",
                label: "Temperature at measurement Tm",
                quantity: "temperature",
                defaultUnit: "C",
                default: 35,
            },
            {
                key: "to",
                label: "Standard temperature To",
                quantity: "temperature",
                defaultUnit: "C",
                default: 20,
            },
        ],
        outputs: [
            {
                key: "corrected",
                label: "Corrected length",
                unit: "m",
                decimals: 4,
                hero: true,
            },
            {
                key: "ct",
                label: "Temperature correction",
                unit: "mm",
                decimals: 2,
            },
            {
                key: "relativeError",
                label: "Relative correction",
                decimals: 6,
                help: "Fraction of the measured length",
            },
        ],
        notes: [
            "At a higher temperature the tape is longer than standard and reads short, so the correction is added.",
        ],
        compute: (v) => {
            const ct = v.length * (v.alpha * 1e-6) * (v.tm - v.to); // metres
            return {
                corrected: v.length + ct,
                ct: ct * 1000,
                relativeError: v.length > 0 ? ct / v.length : 0,
            };
        },
    },

    {
        id: "tape-correction-pull",
        name: "Tape Correction — Pull (Tension)",
        category: "surveying",
        tags: [
            "tape",
            "correction",
            "pull",
            "tension",
            "youngs modulus",
            "chain",
        ],
        summary:
            "Correction to a measured length for a tape pulled at a tension other than standard.",
        formula: "Cp = L × (P − Po) / (A × E)",
        reference:
            "E for steel ≈ 2.1 × 10⁵ N/mm². Standard pull is usually 50–100 N.",
        inputs: [
            {
                key: "length",
                label: "Measured length L",
                quantity: "length",
                defaultUnit: "m",
                default: 100,
                min: 0,
            },
            {
                key: "pull",
                label: "Applied pull P",
                quantity: "force",
                defaultUnit: "N",
                default: 80,
            },
            {
                key: "standard",
                label: "Standard pull Po",
                quantity: "force",
                defaultUnit: "N",
                default: 50,
            },
            {
                key: "area",
                label: "Cross-sectional area of the tape A",
                quantity: "area",
                defaultUnit: "mm2",
                default: 4,
                allowedUnits: ["mm2", "cm2"],
                min: 0,
            },
            {
                key: "e",
                label: "Young's modulus E",
                quantity: "pressure",
                defaultUnit: "MPa",
                default: 210000,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "corrected",
                label: "Corrected length",
                unit: "m",
                decimals: 4,
                hero: true,
            },
            { key: "cp", label: "Pull correction", unit: "mm", decimals: 3 },
        ],
        notes: [
            "If the applied pull exceeds the standard pull the tape stretches, so the correction is added.",
        ],
        compute: (v) => {
            // Axial stiffness A × E has units of force here, so Cp comes out in metres.
            const stiffness = v.area * v.e;
            const cp =
                stiffness > 0
                    ? (v.length * (v.pull - v.standard)) / stiffness
                    : 0;
            return { corrected: v.length + cp, cp: cp * 1000 };
        },
    },

    {
        id: "slope-correction",
        name: "Correction for Slope",
        category: "surveying",
        tags: [
            "slope",
            "correction",
            "hypotenuse",
            "horizontal distance",
            "chain",
            "tape",
        ],
        summary:
            "Horizontal distance from a measured slope distance and the height difference.",
        formula: "Cs = −h² / (2L)\nHorizontal distance = L + Cs",
        reference:
            "The approximation is accurate for gentle slopes; the exact value is √(L² − h²).",
        inputs: [
            {
                key: "length",
                label: "Measured slope length L",
                quantity: "length",
                defaultUnit: "m",
                default: 50,
                min: 0,
            },
            {
                key: "height",
                label: "Height difference h",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "horizontal",
                label: "Horizontal distance (approximate)",
                unit: "m",
                decimals: 4,
                hero: true,
            },
            { key: "cs", label: "Slope correction", unit: "mm", decimals: 2 },
            {
                key: "exactHorizontal",
                label: "Exact horizontal distance √(L² − h²)",
                unit: "m",
                decimals: 4,
            },
            { key: "angle", label: "Slope angle", unit: "°", decimals: 3 },
        ],
        compute: (v) => {
            const cs =
                v.length > 0 ? -(v.height * v.height) / (2 * v.length) : 0;
            const exact = Math.sqrt(
                Math.max(v.length * v.length - v.height * v.height, 0),
            );
            const angleRad =
                v.length > 0 ? Math.asin(Math.min(v.height / v.length, 1)) : 0;
            return {
                horizontal: v.length + cs,
                cs: cs * 1000,
                exactHorizontal: exact,
                angle: (angleRad * 180) / Math.PI,
            };
        },
    },

    {
        id: "volume-trapezoidal",
        name: "Earthwork Volume (Trapezoidal)",
        category: "surveying",
        tags: [
            "earthwork",
            "volume",
            "trapezoidal",
            "mean area",
            "cut",
            "fill",
            "excavation",
        ],
        summary:
            "Volume of earthwork from equally spaced cross-sectional areas.",
        formula: "V = d × ( (A₁ + Aₙ)/2 + A₂ + A₃ + … )",
        reference:
            "Trapezoidal (average end area) rule, with cross-sections at equal intervals d.",
        inputs: [
            {
                key: "d",
                label: "Interval between sections d",
                quantity: "length",
                defaultUnit: "m",
                default: 10,
                min: 0,
            },
            {
                key: "a1",
                label: "Cross-sectional area A₁",
                quantity: "area",
                defaultUnit: "m2",
                default: 12,
                min: 0,
            },
            {
                key: "a2",
                label: "A₂",
                quantity: "area",
                defaultUnit: "m2",
                default: 18,
                min: 0,
            },
            {
                key: "a3",
                label: "A₃",
                quantity: "area",
                defaultUnit: "m2",
                default: 24,
                min: 0,
            },
            {
                key: "a4",
                label: "A₄",
                quantity: "area",
                defaultUnit: "m2",
                default: 15,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "volume",
                label: "Earthwork volume",
                unit: "m³",
                decimals: 2,
                hero: true,
            },
            { key: "length", label: "Total length", unit: "m", decimals: 2 },
            {
                key: "meanArea",
                label: "Mean cross-sectional area",
                unit: "m²",
                decimals: 3,
            },
            {
                key: "bulkVolume",
                label: "Volume with a 15% bulking allowance",
                unit: "m³",
                decimals: 2,
            },
        ],
        notes: [
            "The trapezoidal rule slightly over-estimates compared with the prismoidal formula.",
            "Add bulking when the excavated material has to be transported loose.",
        ],
        compute: (v) => {
            const volume = v.d * ((v.a1 + v.a4) / 2 + v.a2 + v.a3);
            const length = v.d * 3;
            return {
                volume,
                length,
                meanArea: length > 0 ? volume / length : 0,
                bulkVolume: volume * 1.15,
            };
        },
    },

    {
        id: "traverse-misclosure",
        name: "Traverse Misclosure & Accuracy",
        category: "surveying",
        tags: [
            "traverse",
            "misclosure",
            "closing error",
            "accuracy",
            "latitude",
            "departure",
            "bowditch",
        ],
        summary:
            "Linear misclosure of a closed traverse and the resulting accuracy ratio.",
        formula:
            "e = √(ΣL² + ΣD²)\nAccuracy = perimeter ÷ e, quoted as 1 in N\nBowditch correction per metre = −e_component ÷ perimeter",
        reference:
            "Standard traverse adjustment. ΣL is the sum of latitudes (N positive) and ΣD the sum of departures (E positive).",
        inputs: [
            {
                key: "sumLat",
                label: "Σ Latitude (northing − southing)",
                unit: "m",
                default: 0.05,
                step: 0.001,
                help: "Should be zero for a perfect closed traverse",
            },
            {
                key: "sumDep",
                label: "Σ Departure (easting − westing)",
                unit: "m",
                default: -0.08,
                step: 0.001,
                help: "Should be zero for a perfect closed traverse",
            },
            {
                key: "perimeter",
                label: "Total traverse perimeter",
                unit: "m",
                default: 500,
                min: 0.001,
            },
        ],
        outputs: [
            { key: "accuracyText", label: "Accuracy", hero: true },
            {
                key: "misclosure",
                label: "Linear misclosure e",
                unit: "mm",
                decimals: 1,
            },
            { key: "ratio", label: "Accuracy as 1 in N", decimals: 0 },
            {
                key: "latPerMetre",
                label: "Bowditch latitude correction per metre",
                decimals: 7,
            },
            {
                key: "depPerMetre",
                label: "Bowditch departure correction per metre",
                decimals: 7,
            },
            { key: "precisionText", label: "Assessment" },
            {
                key: "closingBearing",
                label: "Direction of the misclosure",
                unit: "°",
                decimals: 1,
            },
        ],
        notes: [
            "Enter the sums AFTER computing the latitudes and departures of every leg — not the individual leg values.",
            "Common accuracy requirements: 1 in 5,000 or better for engineering surveys, 1 in 10,000 for control work, 1 in 1,000 for rough topographic work.",
            "The Bowditch (compass) rule distributes the error in proportion to the length of each leg — multiply the correction per metre by each leg's length.",
            "A large angular misclosure will usually show up here as a large linear misclosure. Check the angles first.",
        ],
        compute: (v) => {
            const misclosure = Math.hypot(v.sumLat, v.sumDep);
            const ratio =
                misclosure > 0
                    ? v.perimeter / misclosure
                    : Number.POSITIVE_INFINITY;

            let precisionText: string;
            let accuracyText: string;
            if (!Number.isFinite(ratio)) {
                precisionText =
                    "Perfect closure — check that the sums were entered";
                accuracyText = "exact";
            } else if (ratio >= 10000) {
                precisionText = "Excellent — suitable for control surveys";
                accuracyText = `1 in ${Math.round(ratio).toLocaleString("en-US")}`;
            } else if (ratio >= 5000) {
                precisionText = "Very good — suitable for engineering surveys";
                accuracyText = `1 in ${Math.round(ratio).toLocaleString("en-US")}`;
            } else if (ratio >= 2000) {
                precisionText =
                    "Good — suitable for most property and engineering work";
                accuracyText = `1 in ${Math.round(ratio).toLocaleString("en-US")}`;
            } else if (ratio >= 1000) {
                precisionText =
                    "Fair — acceptable for rough topographic work only";
                accuracyText = `1 in ${Math.round(ratio).toLocaleString("en-US")}`;
            } else {
                precisionText = "Poor — recheck the fieldwork and the booking";
                accuracyText = `1 in ${Math.round(ratio).toLocaleString("en-US")}`;
            }

            return {
                accuracyText,
                precisionText,
                misclosure: misclosure * 1000,
                ratio: Number.isFinite(ratio) ? ratio : 0,
                latPerMetre: v.perimeter > 0 ? -v.sumLat / v.perimeter : 0,
                depPerMetre: v.perimeter > 0 ? -v.sumDep / v.perimeter : 0,
                closingBearing:
                    (Math.atan2(v.sumDep, v.sumLat) * 180) / Math.PI,
            };
        },
    },

    {
        id: "level-book-rise-fall",
        name: "Level Book (Rise & Fall Method)",
        category: "surveying",
        tags: [
            "level book",
            "rise and fall",
            "reduced level",
            "rl",
            "levelling",
            "booking",
            "arithmetic check",
        ],
        summary:
            "Reduce four staff readings by the rise and fall method, with the standard arithmetic check.",
        formula:
            "Rise when the reading is smaller than the one before it, fall when it is larger\nRL = previous RL + rise OR − fall\nCheck: ΣBS − ΣFS = last RL − first RL",
        reference:
            "Standard level book practice. The check must close, or there is a booking error.",
        inputs: [
            {
                key: "bm",
                label: "Reduced level of the first point (BM)",
                unit: "m",
                default: 100,
            },
            {
                key: "bs",
                label: "Backsight on the BM",
                unit: "m",
                default: 1.465,
                min: 0,
            },
            {
                key: "is1",
                label: "Intermediate sight 1",
                unit: "m",
                default: 1.875,
                min: 0,
            },
            {
                key: "is2",
                label: "Intermediate sight 2",
                unit: "m",
                default: 2.24,
                min: 0,
            },
            {
                key: "fs",
                label: "Foresight on the last point",
                unit: "m",
                default: 1.055,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "rl3",
                label: "RL of the last point",
                unit: "m",
                decimals: 3,
                hero: true,
            },
            { key: "rl1", label: "RL after IS 1", unit: "m", decimals: 3 },
            { key: "rl2", label: "RL after IS 2", unit: "m", decimals: 3 },
            {
                key: "hi",
                label: "Height of instrument",
                unit: "m",
                decimals: 3,
            },
            {
                key: "riseFall1",
                label: "Rise (+) or fall (−) to IS 1",
                unit: "m",
                decimals: 3,
            },
            {
                key: "riseFall2",
                label: "Rise (+) or fall (−) to IS 2",
                unit: "m",
                decimals: 3,
            },
            {
                key: "riseFall3",
                label: "Rise (+) or fall (−) to the last point",
                unit: "m",
                decimals: 3,
            },
            {
                key: "netRise",
                label: "Net rise or fall",
                unit: "m",
                decimals: 3,
            },
            { key: "checkText", label: "Arithmetic check" },
            { key: "checkValue", label: "ΣBS − ΣFS", unit: "m", decimals: 3 },
        ],
        notes: [
            "A rise means the ground went up, so the staff reading got smaller. A fall is the opposite.",
            "The arithmetic check is the whole point of the rise and fall method — if it does not balance, the booking is wrong.",
            "The height of instrument method (a separate calculator) avoids this check but is faster in the field.",
            "For a longer run, carry the last RL forward as the BM for the next instrument station.",
        ],
        compute: (v) => {
            const readings = [v.bs, v.is1, v.is2, v.fs];
            const rls: number[] = [v.bm];
            const deltas: number[] = [];

            for (let i = 1; i < readings.length; i += 1) {
                // Reading smaller than the previous one = rise.
                const delta = readings[i - 1] - readings[i];
                deltas.push(delta);
                rls.push(rls[i - 1] + delta);
            }

            const sumBs = v.bs;
            const sumFs = v.fs;
            const checkValue = sumBs - sumFs;
            const rlDifference = rls[rls.length - 1] - v.bm;
            const balanced = Math.abs(checkValue - rlDifference) < 0.0005;

            return {
                rl1: rls[1],
                rl2: rls[2],
                rl3: rls[3],
                hi: v.bm + v.bs,
                riseFall1: deltas[0],
                riseFall2: deltas[1],
                riseFall3: deltas[2],
                netRise: rlDifference,
                checkValue,
                checkText: balanced
                    ? `Checked — ΣBS − ΣFS = ${checkValue.toFixed(3)} m equals the change in RL`
                    : "MISMATCH — there is a booking or arithmetic error",
            };
        },
    },
];
