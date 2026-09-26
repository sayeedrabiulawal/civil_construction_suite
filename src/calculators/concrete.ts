import type { Calculator } from "@/core/types";
import {
    mixDesignChart,
    strengthGainChart,
    strengthGainRatio,
    wcRatioFromStrength,
} from "./charts";
import { BAG_KG, NOMINAL_MIX_OPTIONS, concreteMaterials } from "./shared";

export const CONCRETE_CALCULATORS: Calculator[] = [
    {
        id: "concrete-mix-materials",
        name: "Concrete Mix Material Calculator",
        category: "concrete",
        tags: [
            "concrete",
            "mix",
            "cement",
            "sand",
            "aggregate",
            "bags",
            "m20",
            "m25",
            "nominal mix",
        ],
        summary:
            "Cement bags, sand and coarse aggregate for a volume of nominal-mix concrete.",
        formula:
            "Dry volume = Wet volume × 1.54\nCement volume = Dry volume ÷ (1 + sand + aggregate)\nCement bags = (Cement volume × 1440) ÷ 50",
        reference:
            "IS 456:2000 Table 9 (nominal mixes). Design mixes (M30 and above) need laboratory trial mixes.",
        inputs: [
            {
                key: "volume",
                label: "Wet volume of concrete",
                quantity: "volume",
                defaultUnit: "m3",
                default: 1,
                min: 0,
            },
            {
                key: "grade",
                label: "Concrete grade",
                kind: "select",
                default: 4,
                options: NOMINAL_MIX_OPTIONS,
            },
            {
                key: "dryFactor",
                label: "Dry volume factor",
                default: 1.54,
                min: 1,
                max: 2,
                step: 0.01,
            },
            {
                key: "wc",
                label: "Water-cement ratio",
                default: 0.5,
                min: 0.3,
                max: 0.8,
                step: 0.05,
            },
            { key: "wastage", label: "Wastage", default: 3, min: 0, max: 20 },
        ],
        outputs: [
            {
                key: "cementBags",
                label: "Cement",
                unit: "bags",
                decimals: 1,
                hero: true,
            },
            {
                key: "cementKg",
                label: "Cement mass",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "sandM3",
                label: "Sand volume",
                quantity: "volume",
                unit: "m3",
            },
            {
                key: "sandKg",
                label: "Sand mass",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "aggM3",
                label: "Coarse aggregate volume",
                quantity: "volume",
                unit: "m3",
            },
            {
                key: "aggKg",
                label: "Coarse aggregate mass",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "water",
                label: "Water",
                quantity: "volume",
                unit: "L",
                decimals: 0,
            },
            {
                key: "dryVolume",
                label: "Dry volume",
                quantity: "volume",
                unit: "m3",
            },
            {
                key: "cementContent",
                label: "Cement content",
                decimals: 0,
                help: "kg of cement per m³ of concrete",
            },
        ],
        notes: [
            "The 1.54 factor converts wet (plastic) concrete volume to the dry loose volume of ingredients.",
            "Always check the minimum cement content and maximum free water-cement ratio required by the exposure condition.",
        ],
        compute: (v) => {
            const m = concreteMaterials(v.volume, v.grade, {
                dryFactor: v.dryFactor,
                wastage: v.wastage,
                wc: v.wc,
            });
            return {
                cementBags: m.cementBags,
                cementKg: m.cementKg,
                sandM3: m.sandM3,
                sandKg: m.sandKg,
                aggM3: m.aggM3,
                aggKg: m.aggKg,
                water: m.waterL,
                dryVolume: m.dryVolume,
                cementContent: m.cementContent,
            };
        },
    },

    {
        id: "water-cement-ratio",
        name: "Water-Cement Ratio Calculator",
        category: "concrete",
        tags: ["water", "cement", "ratio", "wc", "workability", "durability"],
        summary:
            "Water needed for a given cement quantity, or cement needed for a given water quantity.",
        formula:
            "Water = w/c ratio × Cement mass   |   Cement = Water ÷ w/c ratio",
        reference:
            "IS 456:2000 Table 5 limits free water-cement ratio by exposure condition.",
        inputs: [
            {
                key: "mode",
                label: "What do you want to find?",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "Water (enter cement)" },
                    { value: 1, label: "Cement (enter water)" },
                ],
            },
            {
                key: "cement",
                label: "Cement mass",
                quantity: "mass",
                defaultUnit: "kg",
                default: 400,
                min: 0,
                help: "Used when finding water",
            },
            {
                key: "water",
                label: "Water volume",
                quantity: "volume",
                defaultUnit: "L",
                default: 200,
                min: 0,
                help: "Used when finding cement",
            },
            {
                key: "ratio",
                label: "Water-cement ratio",
                default: 0.5,
                min: 0.2,
                max: 1.5,
                step: 0.01,
            },
        ],
        outputs: [
            {
                key: "waterOut",
                label: "Water required",
                quantity: "volume",
                unit: "L",
                decimals: 1,
                hero: true,
            },
            {
                key: "cementOut",
                label: "Cement required",
                quantity: "mass",
                unit: "kg",
                decimals: 1,
            },
            { key: "cementBags", label: "Cement", unit: "bags", decimals: 2 },
            {
                key: "waterPerBag",
                label: "Water per 50 kg bag",
                quantity: "volume",
                unit: "L",
                decimals: 1,
            },
        ],
        notes: [
            "Durability limits (IS 456 Table 5): mild 0.55, moderate 0.50, severe 0.45, very severe 0.45, extreme 0.40.",
            "Water in wet aggregates must be deducted from the batching water.",
        ],
        compute: (v) => {
            // The water input arrives in m³ (SI base); work in litres throughout.
            const waterInputL = v.water * 1000;
            const cementKg =
                v.mode === 0
                    ? v.cement
                    : v.ratio > 0
                      ? waterInputL / v.ratio
                      : 0;
            const waterL = v.mode === 0 ? v.cement * v.ratio : waterInputL;
            return {
                waterOut: waterL,
                cementOut: cementKg,
                cementBags: cementKg / BAG_KG,
                waterPerBag: v.ratio * BAG_KG,
            };
        },
    },

    {
        id: "concrete-cube-strength",
        name: "Concrete Cube Test Strength",
        category: "concrete",
        tags: [
            "cube",
            "test",
            "compressive strength",
            "fck",
            "quality control",
            "nmm2",
        ],
        summary: "Compressive strength of concrete cubes from failure load.",
        formula: "Strength (N/mm²) = Failure load (N) ÷ Cube face area (mm²)",
        reference:
            "IS 516:2018. Standard cubes are 150 mm; 100 mm cubes need a correction factor.",
        inputs: [
            {
                key: "load1",
                label: "Failure load — cube 1",
                quantity: "force",
                defaultUnit: "kN",
                default: 550,
                min: 0,
            },
            {
                key: "load2",
                label: "Failure load — cube 2",
                quantity: "force",
                defaultUnit: "kN",
                default: 575,
                min: 0,
            },
            {
                key: "load3",
                label: "Failure load — cube 3",
                quantity: "force",
                defaultUnit: "kN",
                default: 560,
                min: 0,
            },
            {
                key: "size",
                label: "Cube size",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "150 mm" },
                    { value: 1, label: "100 mm" },
                ],
            },
        ],
        outputs: [
            {
                key: "mean",
                label: "Mean compressive strength",
                quantity: "pressure",
                unit: "MPa",
                decimals: 2,
                hero: true,
            },
            {
                key: "s1",
                label: "Cube 1 strength",
                quantity: "pressure",
                unit: "MPa",
                decimals: 2,
            },
            {
                key: "s2",
                label: "Cube 2 strength",
                quantity: "pressure",
                unit: "MPa",
                decimals: 2,
            },
            {
                key: "s3",
                label: "Cube 3 strength",
                quantity: "pressure",
                unit: "MPa",
                decimals: 2,
            },
            {
                key: "minS",
                label: "Lowest strength",
                quantity: "pressure",
                unit: "MPa",
                decimals: 2,
            },
            {
                key: "maxS",
                label: "Highest strength",
                quantity: "pressure",
                unit: "MPa",
                decimals: 2,
            },
        ],
        notes: [
            "Acceptance (IS 456 Cl. 15.4) for M20 and above: mean of 4 consecutive sets ≥ fck + 0.825 × SD, and no individual result below fck − 4 N/mm².",
            "Loads entered as 0 are still averaged in; clear unwanted rows first.",
        ],
        compute: (v) => {
            const side = v.size === 0 ? 150 : 100; // mm
            const area = side * side; // mm²
            // Load arrives in N, so N ÷ mm² gives N/mm² (MPa) directly.
            const s1 = v.load1 / area;
            const s2 = v.load2 / area;
            const s3 = v.load3 / area;
            const all = [s1, s2, s3];
            return {
                s1,
                s2,
                s3,
                mean: (s1 + s2 + s3) / 3,
                minS: Math.min(...all),
                maxS: Math.max(...all),
            };
        },
    },

    {
        id: "admixture-dosage",
        name: "Admixture Dosage Calculator",
        category: "concrete",
        tags: [
            "admixture",
            "plasticiser",
            "superplasticiser",
            "dosage",
            "retarder",
            "accelerator",
        ],
        summary:
            "Mass and volume of chemical admixture from the dosage percentage of cement.",
        formula:
            "Admixture mass = (Dosage % ÷ 100) × Cement mass\nAdmixture volume = Admixture mass ÷ Admixture density",
        reference:
            "IS 9103. Dosages are always expressed as a percentage of the cement mass.",
        inputs: [
            {
                key: "cementContent",
                label: "Cement content",
                default: 350,
                min: 0,
                help: "kg of cement per m³ of concrete",
            },
            {
                key: "volume",
                label: "Concrete volume",
                quantity: "volume",
                defaultUnit: "m3",
                default: 1,
                min: 0,
            },
            {
                key: "dosage",
                label: "Dosage",
                default: 1,
                min: 0,
                max: 5,
                step: 0.05,
                help: "% of cement mass. Superplasticisers: 0.5–2%.",
            },
            {
                key: "density",
                label: "Admixture density",
                default: 1.1,
                min: 0.8,
                max: 1.5,
                step: 0.01,
                help: "kg per litre",
            },
        ],
        outputs: [
            {
                key: "admixtureVolume",
                label: "Admixture volume",
                quantity: "volume",
                unit: "L",
                decimals: 2,
                hero: true,
            },
            {
                key: "admixtureMass",
                label: "Admixture mass",
                quantity: "mass",
                unit: "kg",
                decimals: 2,
            },
            {
                key: "cementMass",
                label: "Total cement",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "perM3",
                label: "Admixture per m³",
                quantity: "volume",
                unit: "L",
                decimals: 2,
            },
        ],
        notes: [
            "Always run a trial mix — admixture performance depends heavily on the cement and aggregate source.",
        ],
        compute: (v) => {
            const cementMass = v.cementContent * v.volume;
            const admixtureMass = (v.dosage / 100) * cementMass;
            // Guard the divisor: a zero density would give Infinity.
            const admixtureVolume =
                v.density > 0 ? admixtureMass / v.density : 0;
            return {
                admixtureMass,
                admixtureVolume,
                cementMass,
                perM3: v.volume > 0 ? admixtureVolume / v.volume : 0,
            };
        },
    },

    {
        id: "concrete-shrinkage-compaction",
        name: "Concrete Compacted Volume & Yield",
        category: "concrete",
        tags: ["yield", "compaction", "shrinkage", "volume", "batching"],
        summary:
            "Compacted (in-place) volume from loose batch volume, and the yield of a batch.",
        formula:
            "Compacted volume = Loose volume × Compaction factor\nYield = Compacted volume ÷ Batch cement content",
        inputs: [
            {
                key: "looseVolume",
                label: "Loose (batch) volume",
                quantity: "volume",
                defaultUnit: "m3",
                default: 1.2,
                min: 0,
            },
            {
                key: "compactionFactor",
                label: "Compaction factor",
                default: 0.85,
                min: 0.5,
                max: 1,
                step: 0.01,
                help: "Typical 0.80–0.92 for normal concrete.",
            },
            {
                key: "cementKg",
                label: "Cement in the batch",
                quantity: "mass",
                defaultUnit: "kg",
                default: 350,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "compacted",
                label: "Compacted volume",
                quantity: "volume",
                unit: "m3",
                decimals: 4,
                hero: true,
            },
            {
                key: "cementPerM3",
                label: "Cement content achieved",
                decimals: 1,
                help: "kg per m³ of compacted concrete",
            },
            {
                key: "volumeLoss",
                label: "Volume loss on compaction",
                quantity: "volume",
                unit: "m3",
                decimals: 4,
            },
        ],
        compute: (v) => {
            const compacted = v.looseVolume * v.compactionFactor;
            return {
                compacted,
                cementPerM3: compacted > 0 ? v.cementKg / compacted : 0,
                volumeLoss: v.looseVolume - compacted,
            };
        },
    },

    {
        id: "aggregate-moisture-correction",
        name: "Aggregate Moisture Correction",
        category: "concrete",
        tags: [
            "moisture",
            "aggregate",
            "correction",
            "batching",
            "water",
            "absorption",
            "trial mix",
        ],
        summary:
            "Batch weights and mixing water, corrected for the free moisture held in the aggregates.",
        formula:
            "Wet mass = Dry mass × (1 + moisture/100)\nFree water = Dry mass × (moisture − absorption)/100\nWater to add = Cement × w/c − free water from the aggregates",
        reference:
            "Standard batching correction. Moisture up to the absorption value is soaked up by the aggregate and never reaches the mix.",
        inputs: [
            {
                key: "cement",
                label: "Cement mass",
                unit: "kg",
                default: 400,
                min: 0,
            },
            {
                key: "sandDry",
                label: "Sand — dry (SSD) mass",
                unit: "kg",
                default: 700,
                min: 0,
            },
            {
                key: "sandMoisture",
                label: "Sand — total moisture",
                unit: "%",
                default: 5,
                min: 0,
                max: 20,
            },
            {
                key: "sandAbsorption",
                label: "Sand — absorption",
                unit: "%",
                default: 1,
                min: 0,
                max: 10,
            },
            {
                key: "aggDry",
                label: "Coarse aggregate — dry (SSD) mass",
                unit: "kg",
                default: 1200,
                min: 0,
            },
            {
                key: "aggMoisture",
                label: "Coarse aggregate — total moisture",
                unit: "%",
                default: 1.5,
                min: 0,
                max: 20,
            },
            {
                key: "aggAbsorption",
                label: "Coarse aggregate — absorption",
                unit: "%",
                default: 0.5,
                min: 0,
                max: 10,
            },
            {
                key: "wc",
                label: "Water-cement ratio",
                default: 0.5,
                min: 0.2,
                max: 1,
                step: 0.01,
            },
        ],
        outputs: [
            {
                key: "waterToAdd",
                label: "Water to add at the mixer",
                unit: "kg",
                decimals: 1,
                hero: true,
                help: "1 kg of water is 1 litre",
            },
            {
                key: "sandWet",
                label: "Sand — actual batch mass",
                unit: "kg",
                decimals: 1,
            },
            {
                key: "aggWet",
                label: "Coarse aggregate — actual batch mass",
                unit: "kg",
                decimals: 1,
            },
            {
                key: "totalWater",
                label: "Total water for the mix",
                unit: "kg",
                decimals: 1,
            },
            {
                key: "freeWaterSand",
                label: "Free water from the sand",
                unit: "kg",
                decimals: 2,
            },
            {
                key: "freeWaterAgg",
                label: "Free water from the coarse aggregate",
                unit: "kg",
                decimals: 2,
            },
            { key: "advice", label: "Batching advice" },
        ],
        notes: [
            "Free water is the moisture ABOVE the absorption value — that is the water available to the mix.",
            "Weigh the aggregates wet and then add only the computed mixing water. Never top up by eye.",
            "Recheck the moisture content if a stockpile has been rained on.",
        ],
        compute: (v) => {
            const freeWaterSand =
                (v.sandDry * (v.sandMoisture - v.sandAbsorption)) / 100;
            const freeWaterAgg =
                (v.aggDry * (v.aggMoisture - v.aggAbsorption)) / 100;
            const totalWater = v.cement * v.wc;
            const waterToAdd = totalWater - freeWaterSand - freeWaterAgg;

            return {
                waterToAdd,
                sandWet: v.sandDry * (1 + v.sandMoisture / 100),
                aggWet: v.aggDry * (1 + v.aggMoisture / 100),
                totalWater,
                freeWaterSand,
                freeWaterAgg,
                advice:
                    waterToAdd < 0
                        ? "The aggregates hold more water than the mix needs — reduce the sand or add cement"
                        : "Add the computed water; the aggregates already contribute the rest",
            };
        },
    },

    {
        id: "durability-check",
        name: "Durability Check (Cement Content & w/c)",
        category: "concrete",
        tags: [
            "durability",
            "exposure",
            "cement content",
            "water cement ratio",
            "is 456",
            "table 5",
        ],
        summary:
            "Check the cement content, water-cement ratio and grade against the exposure condition.",
        formula:
            "Cement content ≥ the Table 5 minimum\nw/c ratio ≤ the Table 5 maximum\nGrade ≥ the Table 5 minimum grade",
        reference:
            "IS 456:2000 Table 5, for 20 mm nominal maximum size aggregate.",
        inputs: [
            {
                key: "exposure",
                label: "Exposure condition",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Mild" },
                    { value: 1, label: "Moderate" },
                    { value: 2, label: "Severe" },
                    { value: 3, label: "Very severe" },
                    { value: 4, label: "Extreme" },
                ],
            },
            {
                key: "grade",
                label: "Concrete grade used",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "M15" },
                    { value: 1, label: "M20" },
                    { value: 2, label: "M25" },
                    { value: 3, label: "M30" },
                    { value: 4, label: "M35" },
                    { value: 5, label: "M40" },
                    { value: 6, label: "M45 or higher" },
                ],
            },
            {
                key: "cementContent",
                label: "Actual cement content",
                unit: "kg/m³",
                default: 340,
                min: 0,
            },
            {
                key: "wc",
                label: "Actual water-cement ratio",
                default: 0.48,
                min: 0.2,
                max: 1,
                step: 0.01,
            },
        ],
        outputs: [
            { key: "verdict", label: "Overall verdict", hero: true },
            {
                key: "minCement",
                label: "Minimum cement content",
                unit: "kg/m³",
                decimals: 0,
            },
            {
                key: "maxWc",
                label: "Maximum water-cement ratio",
                decimals: 2,
            },
            { key: "minGrade", label: "Minimum grade" },
            { key: "cementStatus", label: "Cement content" },
            { key: "wcStatus", label: "Water-cement ratio" },
            { key: "gradeStatus", label: "Grade" },
        ],
        notes: [
            "Minimum grades in Table 5: mild M20, moderate M25, severe M30, very severe M35, extreme M40.",
            "The governing cement content is the greater of the Table 5 requirement and the strength requirement.",
            "This is one clause of Table 5 only. Cover, cement type and the minimum grade must also be satisfied.",
        ],
        compute: (v) => {
            const minCement = [300, 300, 320, 340, 360][v.exposure];
            const maxWc = [0.55, 0.5, 0.45, 0.45, 0.4][v.exposure];
            const minGradeIndex = [1, 2, 3, 4, 5][v.exposure];
            const grades = [
                "M15",
                "M20",
                "M25",
                "M30",
                "M35",
                "M40",
                "M45 or higher",
            ];
            const minGrade = grades[minGradeIndex];

            const cementOk = v.cementContent >= minCement;
            const wcOk = v.wc <= maxWc;
            const gradeOk = v.grade >= minGradeIndex;
            const failures = [!cementOk, !wcOk, !gradeOk].filter(
                Boolean,
            ).length;

            return {
                minCement,
                maxWc,
                minGrade,
                cementStatus: cementOk
                    ? "OK"
                    : `FAIL — needs at least ${minCement} kg/m³`,
                wcStatus: wcOk ? "OK" : `FAIL — must not exceed ${maxWc}`,
                gradeStatus: gradeOk
                    ? "OK"
                    : `FAIL — use ${minGrade} or higher`,
                verdict:
                    failures === 0
                        ? "PASS — complies with IS 456 Table 5 for this exposure"
                        : `FAIL — ${failures} of the 3 requirements are not met`,
            };
        },
    },

    {
        id: "concrete-maturity",
        name: "Concrete Maturity & Strength Estimate",
        category: "concrete",
        tags: [
            "maturity",
            "nurse saul",
            "strength gain",
            "curing",
            "temperature",
            "stripping",
            "formwork removal",
        ],
        summary:
            "Maturity index, equivalent age at 20 °C and an estimated strength ratio for curing control.",
        formula:
            "M = (T − T₀) × t   [Nurse-Saul, datum T₀ = −10 °C]\nEquivalent age at 20 °C = M ÷ 30 (hours)\nStrength ratio ≈ 0.30 + 0.484 × log₁₀(equivalent age in days)",
        reference:
            "Nurse-Saul maturity method (ASTM C1074), with a logarithmic strength–age fit for ordinary Portland cement concrete.",
        inputs: [
            {
                key: "temp",
                label: "Average curing temperature",
                unit: "°C",
                default: 27,
                min: -10,
                max: 60,
            },
            {
                key: "hours",
                label: "Curing duration",
                unit: "hours",
                default: 168,
                min: 0,
                help: "168 hours is 7 days",
            },
            {
                key: "datum",
                label: "Datum temperature T₀",
                unit: "°C",
                default: -10,
                max: 10,
                help: "ASTM C1074 uses −10 °C",
            },
        ],
        outputs: [
            {
                key: "maturity",
                label: "Maturity index M",
                unit: "°C·h",
                decimals: 0,
                hero: true,
            },
            {
                key: "equivalentDays",
                label: "Equivalent age at 20 °C",
                unit: "days",
                decimals: 2,
            },
            {
                key: "strengthRatio",
                label: "Estimated strength",
                unit: "% of the 28-day value",
                decimals: 1,
            },
            {
                key: "remaining",
                label: "Maturity still needed for the 28-day value",
                unit: "°C·h",
                decimals: 0,
            },
            { key: "stage", label: "Typical site activity" },
        ],
        notes: [
            "The strength estimate uses a logarithmic age fit for ordinary Portland cement. It is indicative only — calibrate against cube results from the same mix before using it for acceptance.",
            "A temperature below the −10 °C datum means no strength gain is taking place.",
            "Cold weather slows maturity sharply, so a maturity meter is far more reliable than assuming a single average temperature.",
            "Formwork striking times must also satisfy the structural loading requirements, not only the strength ratio.",
        ],
        compute: (v) => {
            const effective = Math.max(v.temp - v.datum, 0);
            const maturity = effective * v.hours;
            const equivalentDays = maturity / 30 / 24;

            const raw =
                equivalentDays > 0
                    ? 0.3 + 0.484 * Math.log10(equivalentDays)
                    : 0;
            // Cap at the 28-day reference: this model predicts a fraction of it.
            const strengthRatio = Math.max(0, Math.min(raw * 100, 100));

            // 28 days at 20 °C with a −10 °C datum gives 30 × 24 × 28 °C·h.
            const target = 30 * 24 * 28;

            let stage: string;
            if (strengthRatio < 30)
                stage =
                    "Too weak to load — keep the formwork and props in place";
            else if (strengthRatio < 70)
                stage =
                    "Side forms may be struck; continue curing and avoid heavy loading";
            else if (strengthRatio < 95)
                stage = "Continue curing — approaching the 28-day strength";
            else stage = "Essentially at the 28-day strength";

            return {
                maturity,
                equivalentDays,
                strengthRatio,
                remaining: Math.max(target - maturity, 0),
                stage,
            };
        },
        chart: (v) => {
            const effective = Math.max(v.temp - v.datum, 0);
            const equivalentDays = (effective * v.hours) / 30 / 24;
            const strengthRatio = strengthGainRatio(equivalentDays) * 100;
            return strengthGainChart(equivalentDays, strengthRatio);
        },
    },

    {
        id: "concrete-mix-design",
        name: "Concrete Mix Design (IS 10262)",
        category: "concrete",
        tags: [
            "mix design",
            "is 10262",
            "target mean strength",
            "water cement ratio",
            "absolute volume",
            "mix proportion",
            "trial mix",
        ],
        summary:
            "Design a concrete mix by the absolute volume method: target mean strength, water-cement ratio, water and cement content, then the aggregate weights.",
        formula:
            "f'ck = fck + 1.65 s\nw/c from the strength curve, capped by the durability limit\nW = table value, adjusted for slump and admixture\nC = W ÷ (w/c), raised to the minimum cement content if needed\nVagg = 1 − Vair − Vcement − Vwater\nCA = Vagg × Vca × Gca × 1000      FA = Vagg × (1 − Vca) × Gfa × 1000",
        reference:
            "IS 10262 (mix design procedure), with the durability limits of IS 456:2000 Table 5. Table 2 gives the base water content and Table 3 the volume of coarse aggregate.",
        notes: [
            "This is a design starting point for trial mixes, not a finished specification. Cast the trial, measure the slump and the 28-day cubes, and adjust.",
            "The strength curve is a fit to the standard free water-cement ratio against strength relationship. It is indicative — your cement, aggregate and admixture will differ.",
            "The water content is the total water including the surface moisture of the aggregates. Deduct the free moisture from the batch water, or the mix will be too wet.",
            "The base water content is for a 50 mm slump; the adjustment is 3% per 25 mm of extra slump, limited to 15% — beyond that, add admixture instead of water.",
            "The volume of coarse aggregate per unit volume of total aggregate comes from the code tables. It depends on the aggregate shape and grading, so check it against Table 3 for your materials.",
            "Specific gravities should be measured on your own materials. The defaults are the usual assumed values and give a concrete density of about 2350–2400 kg/m³, which is a useful check that the mix is sensible.",
        ],
        inputs: [
            {
                key: "grade",
                label: "Concrete grade",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "M20" },
                    { value: 1, label: "M25" },
                    { value: 2, label: "M30" },
                    { value: 3, label: "M35" },
                    { value: 4, label: "M40" },
                    { value: 5, label: "M45" },
                    { value: 6, label: "M50" },
                ],
            },
            {
                key: "cementGrade",
                label: "Cement grade",
                kind: "select",
                default: 1,
                options: [
                    { value: 33, label: "OPC 33 grade" },
                    { value: 43, label: "OPC 43 grade" },
                    { value: 53, label: "OPC 53 grade" },
                ],
            },
            {
                key: "exposure",
                label: "Exposure condition",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Mild — min cement 300, max w/c 0.55" },
                    {
                        value: 1,
                        label: "Moderate — min cement 300, max w/c 0.50",
                    },
                    {
                        value: 2,
                        label: "Severe — min cement 320, max w/c 0.45",
                    },
                    {
                        value: 3,
                        label: "Very severe — min cement 340, max w/c 0.45",
                    },
                    {
                        value: 4,
                        label: "Extreme — min cement 360, max w/c 0.40",
                    },
                ],
            },
            {
                key: "size",
                label: "Maximum nominal aggregate size",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "10 mm" },
                    { value: 1, label: "20 mm" },
                    { value: 2, label: "40 mm" },
                ],
            },
            {
                key: "zone",
                label: "Fine aggregate zone",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Zone I (coarsest)" },
                    { value: 1, label: "Zone II" },
                    { value: 2, label: "Zone III" },
                    { value: 3, label: "Zone IV (finest)" },
                ],
            },
            {
                key: "slump",
                label: "Required slump",
                unit: "mm",
                default: 100,
                min: 0,
                max: 200,
                step: 25,
            },
            {
                key: "admixture",
                label: "Admixture",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "None — no water reduction" },
                    { value: 1, label: "Plasticiser — 8% water reduction" },
                    {
                        value: 2,
                        label: "Superplasticiser — 20% water reduction",
                    },
                ],
            },
            {
                key: "vca",
                label: "Coarse aggregate volume per unit total aggregate",
                default: 0.62,
                min: 0.4,
                max: 0.8,
                step: 0.01,
                help: "IS 10262 Table 3 — 0.62 for 20 mm aggregate with Zone II sand at w/c 0.50",
            },
            {
                key: "air",
                label: "Entrapped air",
                unit: "%",
                default: 2,
                min: 0,
                max: 6,
                step: 0.5,
            },
            {
                key: "sgCement",
                label: "Specific gravity of cement",
                default: 3.15,
                min: 2.5,
                max: 3.5,
                step: 0.01,
            },
            {
                key: "sgFine",
                label: "Specific gravity of fine aggregate",
                default: 2.65,
                min: 2.2,
                max: 3,
                step: 0.01,
            },
            {
                key: "sgCoarse",
                label: "Specific gravity of coarse aggregate",
                default: 2.7,
                min: 2.2,
                max: 3,
                step: 0.01,
            },
        ],
        outputs: [
            {
                key: "wc",
                label: "Adopted free water-cement ratio",
                decimals: 3,
                hero: true,
            },
            {
                key: "targetStrength",
                label: "Target mean strength f'ck",
                unit: "MPa",
                decimals: 2,
            },
            {
                key: "wcFromCurve",
                label: "Ratio the strength curve gives",
                decimals: 3,
            },
            {
                key: "cementContent",
                label: "Cement content",
                unit: "kg/m³",
                decimals: 1,
            },
            {
                key: "cementBags",
                label: "Cement",
                unit: "bags/m³",
                decimals: 2,
            },
            {
                key: "waterContent",
                label: "Water content",
                unit: "kg/m³",
                decimals: 1,
            },
            {
                key: "fineAggregate",
                label: "Fine aggregate",
                unit: "kg/m³",
                decimals: 1,
            },
            {
                key: "coarseAggregate",
                label: "Coarse aggregate",
                unit: "kg/m³",
                decimals: 1,
            },
            { key: "proportion", label: "Mix proportion by mass" },
            {
                key: "density",
                label: "Total mass per m³ (check)",
                unit: "kg/m³",
                decimals: 1,
            },
            { key: "compliance", label: "Durability check" },
        ],
        compute: (v) => {
            const GRADES = [20, 25, 30, 35, 40, 45, 50];
            const DEVIATION = [4.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0];
            // IS 456 Table 5, reinforced concrete: [min cement kg/m³, max w/c]
            const DURABILITY: [number, number][] = [
                [300, 0.55],
                [300, 0.5],
                [320, 0.45],
                [340, 0.45],
                [360, 0.4],
            ];
            // IS 10262 Table 2, water content for a 50 mm slump, kg/m³.
            const BASE_WATER = [208, 186, 165];
            const REDUCTION = [0, 0.08, 0.2];

            const index = Math.min(Math.max(v.grade, 0), GRADES.length - 1);
            const fck = GRADES[index];
            const s = DEVIATION[index];
            const targetStrength = fck + 1.65 * s;

            const cementGrade =
                v.cementGrade === 33 || v.cementGrade === 53
                    ? v.cementGrade
                    : 43;
            const [minCement, maxWc] =
                DURABILITY[Math.min(Math.max(v.exposure, 0), 4)];

            const wcFromCurve = wcRatioFromStrength(
                targetStrength,
                cementGrade,
            );
            // The code takes the lower of the strength ratio and the durability
            // cap, and never goes below 0.30 in practice.
            const wc = Math.max(Math.min(wcFromCurve, maxWc), 0.3);

            const sizeIndex = Math.min(Math.max(v.size, 0), 2);
            const slumpFactor = Math.min(
                Math.max(1 + 0.03 * ((v.slump - 50) / 25), 0.85),
                1.15,
            );
            const admixtureIndex = Math.min(Math.max(v.admixture, 0), 2);
            const waterContent = Math.max(
                BASE_WATER[sizeIndex] *
                    slumpFactor *
                    (1 - REDUCTION[admixtureIndex]),
                0,
            );

            // Cement follows from the water, but the durability minimum wins.
            const cementFromWc = wc > 0 ? waterContent / wc : 0;
            const cementContent = Math.max(cementFromWc, minCement);
            const effectiveWc =
                cementContent > 0 ? waterContent / cementContent : 0;

            const air = Math.min(Math.max(v.air, 0), 10) / 100;
            const sgCement = Math.max(v.sgCement, 0.1);
            const sgFine = Math.max(v.sgFine, 0.1);
            const sgCoarse = Math.max(v.sgCoarse, 0.1);

            // Absolute volume method on a 1 m³ basis.
            const cementVolume = cementContent / (sgCement * 1000);
            const waterVolume = waterContent / 1000;
            const aggVolume = Math.max(1 - air - cementVolume - waterVolume, 0);

            const vca = Math.min(Math.max(v.vca, 0), 1);
            const coarseMass = aggVolume * vca * sgCoarse * 1000;
            const fineMass = aggVolume * (1 - vca) * sgFine * 1000;

            const ratio = (mass: number) =>
                cementContent > 0 ? mass / cementContent : 0;

            const density =
                cementContent + waterContent + fineMass + coarseMass;

            // Say plainly which limit governed the water-cement ratio.
            let compliance: string;
            if (wcFromCurve > maxWc)
                compliance = `Durability governs — the strength curve wanted ${wcFromCurve.toFixed(3)}, capped at ${maxWc.toFixed(2)} for this exposure`;
            else
                compliance = `Strength governs — ${wc.toFixed(3)} is below the ${maxWc.toFixed(2)} durability cap`;

            if (cementContent > cementFromWc + 0.5)
                compliance += `, and the minimum cement content raised it from ${cementFromWc.toFixed(0)} kg/m³`;

            return {
                wc: effectiveWc,
                targetStrength,
                wcFromCurve,
                cementContent,
                cementBags: cementContent / BAG_KG,
                waterContent,
                fineAggregate: fineMass,
                coarseAggregate: coarseMass,
                proportion: `1 : ${ratio(fineMass).toFixed(2)} : ${ratio(coarseMass).toFixed(2)}  (cement : fine : coarse)`,
                density,
                compliance,
            };
        },
        chart: (v) => {
            const GRADES = [20, 25, 30, 35, 40, 45, 50];
            const DEVIATION = [4.0, 5.0, 5.0, 5.0, 5.0, 5.0, 5.0];
            const DURABILITY: [number, number][] = [
                [300, 0.55],
                [300, 0.5],
                [320, 0.45],
                [340, 0.45],
                [360, 0.4],
            ];

            const index = Math.min(Math.max(v.grade, 0), GRADES.length - 1);
            const targetStrength = GRADES[index] + 1.65 * DEVIATION[index];
            const cementGrade =
                v.cementGrade === 33 || v.cementGrade === 53
                    ? v.cementGrade
                    : 43;
            const maxWc = DURABILITY[Math.min(Math.max(v.exposure, 0), 4)][1];
            const wcFromCurve = wcRatioFromStrength(
                targetStrength,
                cementGrade,
            );
            const wc = Math.max(Math.min(wcFromCurve, maxWc), 0.3);

            return mixDesignChart({
                cementGrade,
                targetStrength,
                designWc: wc,
                // Keep the cap line inside the plotted range.
                maxWc: Math.min(Math.max(maxWc, 0.3), 0.75),
            });
        },
    },
];
