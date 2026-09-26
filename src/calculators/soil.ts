import type { Calculator } from "@/core/types";
import {
    FM_SIEVES,
    ZONE_LIMITS,
    degreeOfConsolidation,
    gradationChart,
    settlementTimeChart,
} from "./charts";
import { G } from "./shared";

/**
 * Soil & geotechnical calculators.
 *
 * Inputs arrive in SI base units: masses in kg, densities in kg/m³, unit weights
 * in N/m³. Results are reported in the laboratory units engineers actually use
 * (grams, kN/m³), so `compute` converts at the end.
 */
const WATER_DENSITY = 1000; // kg/m³
const KG_TO_G = 1000;
const N_TO_KN = 1 / 1000;

export const SOIL_CALCULATORS: Calculator[] = [
    {
        id: "moisture-content",
        name: "Soil Moisture Content",
        category: "soil",
        tags: ["moisture", "water content", "oven dry", "geotech", "lab"],
        summary: "Water content of a soil sample from the oven-drying method.",
        formula: "w = (M₂ − M₃) / (M₃ − M₁) × 100",
        reference:
            "IS 2720 (Part 2). M₁ = empty container, M₂ = container + wet soil, M₃ = container + dry soil.",
        inputs: [
            {
                key: "m1",
                label: "M₁ — empty container",
                quantity: "mass",
                defaultUnit: "g",
                default: 25,
                min: 0,
            },
            {
                key: "m2",
                label: "M₂ — container + wet soil",
                quantity: "mass",
                defaultUnit: "g",
                default: 145,
                min: 0,
            },
            {
                key: "m3",
                label: "M₃ — container + dry soil",
                quantity: "mass",
                defaultUnit: "g",
                default: 125,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "waterContent",
                label: "Water content w",
                unit: "%",
                decimals: 2,
                hero: true,
            },
            {
                key: "waterMass",
                label: "Mass of water",
                unit: "g",
                decimals: 2,
            },
            {
                key: "dryMass",
                label: "Mass of dry soil",
                unit: "g",
                decimals: 2,
            },
        ],
        notes: [
            "Dry the sample at 105–110 °C to constant mass. Organic soils and gypsum need lower temperatures.",
        ],
        compute: (v) => {
            const dryMass = v.m3 - v.m1; // kg
            const waterMass = v.m2 - v.m3; // kg
            return {
                waterContent: dryMass !== 0 ? (waterMass / dryMass) * 100 : 0,
                waterMass: waterMass * KG_TO_G,
                dryMass: dryMass * KG_TO_G,
            };
        },
    },

    {
        id: "bulk-dry-density",
        name: "Bulk & Dry Density",
        category: "soil",
        tags: [
            "density",
            "bulk density",
            "dry density",
            "unit weight",
            "moisture",
        ],
        summary:
            "Convert between bulk density and dry density using the water content.",
        formula: "γd = γ / (1 + w/100)\nγd(kN/m³) = γd(kg/m³) × g / 1000",
        reference: "IS 2720 (Part 3).",
        inputs: [
            {
                key: "bulk",
                label: "Bulk (wet) density γ",
                quantity: "density",
                defaultUnit: "kgm3",
                default: 1900,
                min: 0,
            },
            {
                key: "waterContent",
                label: "Water content w",
                unit: "%",
                default: 12,
                min: 0,
                help: "% by mass",
            },
        ],
        outputs: [
            {
                key: "dryDensity",
                label: "Dry density γd",
                unit: "kg/m³",
                decimals: 1,
                hero: true,
            },
            {
                key: "dryUnitWeight",
                label: "Dry unit weight",
                unit: "kN/m³",
                decimals: 2,
            },
            {
                key: "bulkUnitWeight",
                label: "Bulk unit weight",
                unit: "kN/m³",
                decimals: 2,
            },
            {
                key: "waterMassPerM3",
                label: "Mass of water per m³",
                unit: "kg/m³",
                decimals: 1,
            },
        ],
        compute: (v) => {
            const dry = v.bulk / (1 + v.waterContent / 100);
            return {
                dryDensity: dry,
                dryUnitWeight: dry * G * N_TO_KN,
                bulkUnitWeight: v.bulk * G * N_TO_KN,
                waterMassPerM3: v.bulk - dry,
            };
        },
    },

    {
        id: "void-ratio",
        name: "Void Ratio & Porosity",
        category: "soil",
        tags: [
            "void ratio",
            "porosity",
            "saturation",
            "specific gravity",
            "geotech",
        ],
        summary:
            "Void ratio, porosity, degree of saturation and saturated density of a soil.",
        formula:
            "e = (Gs γw / γd) − 1\nn = e / (1 + e)\nSr = w Gs / e\nγsat = ((Gs + e) / (1 + e)) × γw",
        reference: "IS 2720 (Part 3 & 4). γw = 1000 kg/m³.",
        inputs: [
            {
                key: "gs",
                label: "Specific gravity of solids Gs",
                default: 2.65,
                min: 0,
                max: 4,
                step: 0.01,
            },
            {
                key: "dryDensity",
                label: "Dry density γd",
                quantity: "density",
                defaultUnit: "kgm3",
                default: 1650,
                min: 0,
            },
            {
                key: "waterContent",
                label: "Water content w",
                unit: "%",
                default: 12,
                min: 0,
                help: "% by mass",
            },
        ],
        outputs: [
            { key: "e", label: "Void ratio e", decimals: 4, hero: true },
            { key: "n", label: "Porosity n", decimals: 4 },
            {
                key: "porosityPercent",
                label: "Porosity",
                unit: "%",
                decimals: 2,
            },
            {
                key: "sr",
                label: "Degree of saturation Sr",
                unit: "%",
                decimals: 2,
            },
            {
                key: "satDensity",
                label: "Saturated density γsat",
                unit: "kg/m³",
                decimals: 1,
            },
            {
                key: "submergedDensity",
                label: "Submerged density γ′",
                unit: "kg/m³",
                decimals: 1,
            },
        ],
        notes: [
            "Sr = 100% means the soil is fully saturated. Sr above 100% means the input data is inconsistent.",
            "Submerged density applies below the water table: γ′ = γsat − γw.",
        ],
        compute: (v) => {
            const e =
                v.dryDensity > 0
                    ? (v.gs * WATER_DENSITY) / v.dryDensity - 1
                    : 0;
            const n = e > -1 ? e / (1 + e) : 0;
            const w = v.waterContent / 100;
            const sr = e > 0 ? (w * v.gs) / e : 0;
            const satDensity =
                e > -1 ? ((v.gs + e) / (1 + e)) * WATER_DENSITY : 0;
            return {
                e,
                n,
                porosityPercent: n * 100,
                sr: sr * 100,
                satDensity,
                submergedDensity: satDensity - WATER_DENSITY,
            };
        },
    },

    {
        id: "specific-gravity-pycnometer",
        name: "Specific Gravity (Pycnometer)",
        category: "soil",
        tags: ["specific gravity", "gs", "pycnometer", "density bottle", "lab"],
        summary:
            "Specific gravity of soil solids from the pycnometer (density bottle) method.",
        formula: "Gs = (M₂ − M₁) / ((M₂ − M₁) − (M₃ − M₄))",
        reference:
            "IS 2720 (Part 3). M₁ empty, M₂ + dry soil, M₃ + soil + water, M₄ + water only.",
        inputs: [
            {
                key: "m1",
                label: "M₁ — empty pycnometer",
                quantity: "mass",
                defaultUnit: "g",
                default: 650,
                min: 0,
            },
            {
                key: "m2",
                label: "M₂ — pycnometer + dry soil",
                quantity: "mass",
                defaultUnit: "g",
                default: 850,
                min: 0,
            },
            {
                key: "m3",
                label: "M₃ — pycnometer + soil + water",
                quantity: "mass",
                defaultUnit: "g",
                default: 1652,
                min: 0,
            },
            {
                key: "m4",
                label: "M₄ — pycnometer + water",
                quantity: "mass",
                defaultUnit: "g",
                default: 1524,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "gs",
                label: "Specific gravity Gs",
                decimals: 3,
                hero: true,
            },
            {
                key: "soilMass",
                label: "Mass of dry soil",
                unit: "g",
                decimals: 2,
            },
        ],
        notes: [
            "Typical values: sand 2.65–2.67, silt 2.67–2.70, clay 2.70–2.80, organic soil below 2.0.",
            "Correct for temperature if the test is not carried out at the calibration temperature.",
        ],
        compute: (v) => {
            const numerator = v.m2 - v.m1;
            const denominator = numerator - (v.m3 - v.m4);
            return {
                gs: denominator !== 0 ? numerator / denominator : 0,
                soilMass: numerator * KG_TO_G,
            };
        },
    },

    {
        id: "fineness-modulus",
        name: "Fineness Modulus (Sieve Analysis)",
        category: "soil",
        tags: [
            "fineness modulus",
            "sieve",
            "gradation",
            "aggregate",
            "fm",
            "sand",
        ],
        summary:
            "Fineness modulus of fine or coarse aggregate from cumulative percentage retained.",
        formula: "FM = Σ (cumulative % retained on each sieve) ÷ 100",
        reference:
            "IS 383. Standard sieves: 4.75, 2.36, 1.18 mm and 600, 300, 150 µm.",
        inputs: [
            {
                key: "s475",
                label: "Cumulative % retained on 4.75 mm",
                unit: "%",
                default: 0,
                min: 0,
                max: 100,
            },
            {
                key: "s236",
                label: "on 2.36 mm",
                unit: "%",
                default: 5,
                min: 0,
                max: 100,
            },
            {
                key: "s118",
                label: "on 1.18 mm",
                unit: "%",
                default: 20,
                min: 0,
                max: 100,
            },
            {
                key: "s600",
                label: "on 600 µm",
                unit: "%",
                default: 45,
                min: 0,
                max: 100,
            },
            {
                key: "s300",
                label: "on 300 µm",
                unit: "%",
                default: 75,
                min: 0,
                max: 100,
            },
            {
                key: "s150",
                label: "on 150 µm",
                unit: "%",
                default: 92,
                min: 0,
                max: 100,
            },
            {
                key: "type",
                label: "Aggregate type",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "Fine aggregate (sand)" },
                    { value: 1, label: "Coarse aggregate (20 mm)" },
                ],
            },
        ],
        outputs: [
            { key: "fm", label: "Fineness modulus", decimals: 2, hero: true },
            { key: "sum", label: "Sum of cumulative % retained", decimals: 1 },
            { key: "zoneText", label: "Grading zone" },
        ],
        notes: [
            "IS 383 zones for fine aggregate: FM 2.2–2.6 (Zone I, coarsest) down to 1.5–1.9 (Zone IV, finest).",
            "Coarse aggregate FM usually falls between 5.5 and 8.0.",
        ],
        compute: (v) => {
            const sum = v.s475 + v.s236 + v.s118 + v.s600 + v.s300 + v.s150;
            const fm = sum / 100;

            let zoneText: string;
            if (v.type === 1) {
                zoneText = "Coarse aggregate — zone grading does not apply";
            } else if (fm >= 2.4) zoneText = "Zone I (coarse sand)";
            else if (fm >= 2.0) zoneText = "Zone II (standard sand)";
            else if (fm >= 1.7) zoneText = "Zone III (fine sand)";
            else zoneText = "Zone IV (very fine sand)";

            return { fm, sum, zoneText };
        },
        chart: (v) => {
            // Zone grading is only defined for fine aggregate.
            if (v.type === 1) return null;

            const fm =
                (v.s475 + v.s236 + v.s118 + v.s600 + v.s300 + v.s150) / 100;
            const zone: keyof typeof ZONE_LIMITS =
                fm >= 2.4 ? "I" : fm >= 2.0 ? "II" : fm >= 1.7 ? "III" : "IV";

            // Inputs are cumulative % RETAINED; the curve plots % PASSING.
            const passing = FM_SIEVES.map((sieve, index) => ({
                sieve,
                passing: Math.max(
                    0,
                    100 -
                        [v.s475, v.s236, v.s118, v.s600, v.s300, v.s150][index],
                ),
            }));

            return gradationChart(
                passing,
                zone,
                `IS 383 ${ZONE_LIMITS[zone].name} grading limits. Plotted against the standard sieves on a log scale, which is how a gradation curve is always read.`,
            );
        },
    },

    {
        id: "field-density-sand-cone",
        name: "Field Density & Compaction",
        category: "soil",
        tags: [
            "field density",
            "sand replacement",
            "core cutter",
            "compaction",
            "relative compaction",
            "mdd",
        ],
        summary:
            "In-situ bulk density, dry density and relative compaction against the laboratory MDD.",
        formula:
            "γ = Mass of soil ÷ Volume of hole\nγd = γ / (1 + w/100)\nRelative compaction = γd ÷ MDD × 100",
        reference:
            "IS 2720 (Part 28 & 29) — sand replacement and core cutter methods.",
        inputs: [
            {
                key: "soilMass",
                label: "Mass of soil from the hole",
                quantity: "mass",
                defaultUnit: "kg",
                default: 3.6,
                min: 0,
            },
            {
                key: "holeVolume",
                label: "Volume of the hole",
                quantity: "volume",
                defaultUnit: "m3",
                default: 0.0019,
                min: 0,
            },
            {
                key: "waterContent",
                label: "Water content w",
                unit: "%",
                default: 11,
                min: 0,
            },
            {
                key: "mdd",
                label: "Maximum dry density (MDD)",
                quantity: "density",
                defaultUnit: "kgm3",
                default: 1850,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "relativeCompaction",
                label: "Relative compaction",
                unit: "%",
                decimals: 2,
                hero: true,
            },
            {
                key: "bulkDensity",
                label: "Bulk density γ",
                unit: "kg/m³",
                decimals: 1,
            },
            {
                key: "dryDensity",
                label: "Dry density γd",
                unit: "kg/m³",
                decimals: 1,
            },
            {
                key: "dryUnitWeight",
                label: "Dry unit weight",
                unit: "kN/m³",
                decimals: 2,
            },
            {
                key: "deficit",
                label: "Deficit against MDD",
                unit: "kg/m³",
                decimals: 1,
            },
        ],
        notes: [
            "Most specifications require 95–98% relative compaction for embankments and 98–100% for subgrade.",
            "Compare the field water content with the laboratory OMC before accepting the compaction.",
        ],
        compute: (v) => {
            const bulk = v.holeVolume > 0 ? v.soilMass / v.holeVolume : 0;
            const dry = bulk / (1 + v.waterContent / 100);
            return {
                bulkDensity: bulk,
                dryDensity: dry,
                dryUnitWeight: dry * G * N_TO_KN,
                relativeCompaction: v.mdd > 0 ? (dry / v.mdd) * 100 : 0,
                deficit: v.mdd - dry,
            };
        },
    },

    {
        id: "atterberg-limits",
        name: "Atterberg Limits & Indices",
        category: "soil",
        tags: [
            "atterberg",
            "liquid limit",
            "plastic limit",
            "plasticity index",
            "consistency",
        ],
        summary:
            "Plasticity index, liquidity index and consistency index of a fine-grained soil.",
        formula: "PI = LL − PL\nLI = (w − PL) / PI\nCI = (LL − w) / PI",
        reference: "IS 2720 (Part 5 & 6).",
        inputs: [
            {
                key: "ll",
                label: "Liquid limit LL",
                unit: "%",
                default: 45,
                min: 0,
                max: 200,
            },
            {
                key: "pl",
                label: "Plastic limit PL",
                unit: "%",
                default: 22,
                min: 0,
                max: 200,
            },
            {
                key: "natural",
                label: "Natural water content w",
                unit: "%",
                default: 28,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "pi",
                label: "Plasticity index PI",
                unit: "%",
                decimals: 2,
                hero: true,
            },
            { key: "consistencyText", label: "Consistency of the soil" },
            { key: "li", label: "Liquidity index LI", decimals: 3 },
            { key: "ci", label: "Consistency index CI", decimals: 3 },
            { key: "plasticityText", label: "Plasticity class" },
        ],
        notes: [
            "PI below 7 = low plasticity (silt), 7–17 = medium, above 17 = high plasticity (clay).",
            "Consistency index: above 1 semi-solid, 0.75–1 stiff, 0.5–0.75 medium, 0–0.5 soft, below 0 liquid.",
            "A negative consistency index means the soil is in a liquid state at its natural water content.",
        ],
        compute: (v) => {
            const pi = v.ll - v.pl;
            const li = pi > 0 ? (v.natural - v.pl) / pi : 0;
            const ci = pi > 0 ? (v.ll - v.natural) / pi : 0;

            let consistencyText: string;
            if (ci > 1) consistencyText = "Semi-solid to solid";
            else if (ci > 0.75) consistencyText = "Stiff";
            else if (ci > 0.5) consistencyText = "Medium";
            else if (ci > 0) consistencyText = "Soft";
            else consistencyText = "Liquid state";

            let plasticityText: string;
            if (pi < 7) plasticityText = "Low plasticity (silty)";
            else if (pi <= 17) plasticityText = "Medium plasticity";
            else plasticityText = "High plasticity (clayey)";

            return { pi, li, ci, consistencyText, plasticityText };
        },
    },

    {
        id: "spt-bearing-capacity",
        name: "Bearing Capacity from SPT",
        category: "soil",
        tags: [
            "spt",
            "n value",
            "blow count",
            "bearing capacity",
            "standard penetration",
            "allowable pressure",
            "in situ",
        ],
        summary:
            "Safe bearing capacity from a standard penetration test blow count, with overburden correction.",
        formula:
            "σ′v = γ z − u\nCN = √(100 / σ′v),  N₁ = CN × N\nφ = 27 + 0.3 N₁  (capped at 45°)\nqu = σ′v Nq + 0.5 γ B Nγ",
        reference:
            "Peck, Hanson & Thornburn for the φ correlation, then Terzaghi for the capacity. N₁ is capped at 50 blows.",
        inputs: [
            {
                key: "nField",
                label: "Field SPT N value",
                unit: "blows/300mm",
                default: 15,
                min: 1,
                max: 100,
                help: "Sum of the blows for the last 300 mm penetration",
            },
            {
                key: "depth",
                label: "Depth of the test (or of the footing base)",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
            {
                key: "waterDepth",
                label: "Depth to the water table",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
            {
                key: "gamma",
                label: "Soil unit weight above the water table",
                quantity: "unitWeight",
                defaultUnit: "kNm3",
                default: 18,
                min: 0,
            },
            {
                key: "width",
                label: "Footing width B",
                quantity: "length",
                defaultUnit: "m",
                default: 1.5,
                min: 0,
            },
            {
                key: "fos",
                label: "Factor of safety",
                default: 3,
                min: 1.5,
                max: 5,
                step: 0.5,
            },
        ],
        outputs: [
            {
                key: "safeNet",
                label: "Net safe bearing capacity",
                unit: "kN/m²",
                decimals: 1,
                hero: true,
            },
            {
                key: "nCorrected",
                label: "Corrected N₁ value",
                unit: "blows",
                decimals: 1,
            },
            {
                key: "phi",
                label: "Estimated friction angle φ",
                unit: "°",
                decimals: 1,
            },
            { key: "subgradeQuality", label: "Relative density / consistency" },
            {
                key: "effectiveStress",
                label: "Effective overburden σ′v",
                unit: "kN/m²",
                decimals: 1,
            },
            { key: "cn", label: "Overburden correction CN", decimals: 3 },
            {
                key: "qu",
                label: "Ultimate gross capacity qu",
                unit: "kN/m²",
                decimals: 1,
            },
            {
                key: "safeGross",
                label: "Gross safe bearing capacity",
                unit: "kN/m²",
                decimals: 1,
            },
        ],
        notes: [
            "Assumes a cohesionless soil. For clays use the undrained cohesion instead — the N correlation does not apply.",
            "The correction CN = √(100/σ′v) is limited to the range 0.5–2.0, as is usual practice.",
            "A very shallow water table greatly reduces the effective stress and therefore the capacity.",
            "SPT correlations are approximate. Confirm with plate load tests or laboratory data for final design.",
        ],
        compute: (v) => {
            // v.depth and v.waterDepth in m, v.gamma in N/m³.
            const sigmaV = v.gamma * v.depth; // Pa
            const u =
                v.waterDepth < v.depth ? 9810 * (v.depth - v.waterDepth) : 0; // Pa
            const sigmaEff = Math.max(sigmaV - u, 1000); // Pa, floored to avoid a divide by zero

            const cn = Math.min(Math.max(Math.sqrt(100000 / sigmaEff), 0.5), 2);
            const nCorrected = Math.min(v.nField * cn, 50);

            const phiDeg = Math.min(27 + 0.3 * nCorrected, 45);
            const phi = (phiDeg * Math.PI) / 180;

            const nq =
                Math.exp(Math.PI * Math.tan(phi)) *
                Math.tan(Math.PI / 4 + phi / 2) ** 2;
            const ngamma = 2 * (nq + 1) * Math.tan(phi);

            const qu = sigmaEff * nq + 0.5 * v.gamma * v.width * ngamma; // Pa
            const netQu = Math.max(qu - sigmaEff, 0);
            const safeNet = netQu / Math.max(v.fos, 0.1);

            let subgradeQuality: string;
            if (nCorrected < 4) subgradeQuality = "Very loose / very soft";
            else if (nCorrected < 10) subgradeQuality = "Loose / soft";
            else if (nCorrected < 30) subgradeQuality = "Medium dense / firm";
            else if (nCorrected < 50) subgradeQuality = "Dense / stiff";
            else subgradeQuality = "Very dense / hard";

            return {
                safeNet: safeNet * N_TO_KN,
                safeGross: (safeNet + sigmaEff) * N_TO_KN,
                qu: qu * N_TO_KN,
                nCorrected,
                phi: phiDeg,
                cn,
                effectiveStress: sigmaEff * N_TO_KN,
                subgradeQuality,
            };
        },
    },

    {
        id: "consolidation-settlement",
        name: "Consolidation Settlement",
        category: "soil",
        tags: [
            "settlement",
            "consolidation",
            "clay",
            "cc",
            "cv",
            "degree of consolidation",
            "time rate",
        ],
        summary:
            "Primary consolidation settlement and its progress with time for a clay layer.",
        formula:
            "S = H Cc / (1 + e₀) × log₁₀((σ′₀ + Δσ) / σ′₀)\nTv = Cv t / Hdr²\nTv = πU²/4 (U ≤ 60%),  Tv = 1.781 − 0.933 log₁₀(100 − U) (U > 60%)",
        reference:
            "Terzaghi one-dimensional consolidation theory and IS 8009. Cc is the compression index.",
        inputs: [
            {
                key: "thickness",
                label: "Thickness of the clay layer H",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "e0",
                label: "Initial void ratio e₀",
                default: 0.9,
                min: 0.1,
                max: 3,
                step: 0.01,
            },
            {
                key: "cc",
                label: "Compression index Cc",
                default: 0.3,
                min: 0.01,
                max: 1.5,
                step: 0.01,
            },
            {
                key: "sigma0",
                label: "Initial effective stress σ′₀ at mid-depth",
                unit: "kN/m²",
                default: 100,
                min: 1,
            },
            {
                key: "dSigma",
                label: "Net stress increase Δσ from the foundation",
                unit: "kN/m²",
                default: 50,
                min: 0,
            },
            {
                key: "cv",
                label: "Coefficient of consolidation Cv",
                unit: "m²/year",
                default: 2,
                min: 0.01,
                step: 0.01,
            },
            {
                key: "drainage",
                label: "Drainage condition",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Drainage on one side (Hdr = H)" },
                    { value: 1, label: "Drainage on both sides (Hdr = H/2)" },
                ],
            },
            {
                key: "years",
                label: "Time since loading",
                unit: "years",
                default: 1,
                min: 0,
                step: 0.1,
            },
        ],
        outputs: [
            {
                key: "settlement",
                label: "Ultimate consolidation settlement",
                unit: "mm",
                decimals: 1,
                hero: true,
            },
            {
                key: "settlementAtTime",
                label: "Settlement reached at this time",
                unit: "mm",
                decimals: 1,
            },
            {
                key: "degree",
                label: "Degree of consolidation U",
                unit: "%",
                decimals: 1,
            },
            { key: "timeFactor", label: "Time factor Tv", decimals: 4 },
            {
                key: "drainagePath",
                label: "Drainage path Hdr",
                unit: "m",
                decimals: 3,
            },
            {
                key: "timeFor90",
                label: "Time for 90% consolidation",
                unit: "years",
                decimals: 3,
            },
        ],
        notes: [
            "This is primary consolidation only. Secondary compression continues after it finishes.",
            "If the clay is over-consolidated and σ′₀ + Δσ stays below the preconsolidation pressure, the recompression index Cr applies instead of Cc, and the settlement will be much smaller.",
            "Sand drains or prefabricated vertical drains shorten the drainage path and speed the settlement up.",
            "Differential settlement matters more than the total — check it across the structure as well.",
        ],
        compute: (v) => {
            const Hm = v.thickness;
            // The log term needs a positive initial effective stress, so guard it
            // rather than taking the logarithm of infinity.
            const settlement =
                v.sigma0 > 0
                    ? Hm *
                      1000 *
                      (v.cc / (1 + v.e0)) *
                      Math.log10((v.sigma0 + v.dSigma) / v.sigma0)
                    : 0;

            const hdr = v.drainage === 0 ? Hm : Hm / 2;
            const tv = hdr > 0 ? (v.cv * v.years) / (hdr * hdr) : 0;

            // Invert the standard Tv–U relationships.
            let u: number; // fraction
            if (tv <= 0.2827) {
                u = Math.sqrt((4 * tv) / Math.PI);
            } else if (tv >= 2.2) {
                u = 1;
            } else {
                u = 1 - 10 ** ((1.781 - tv) / 0.933) / 100;
            }

            const t90 = v.cv > 0 ? (0.848 * hdr * hdr) / v.cv : 0;

            return {
                settlement,
                settlementAtTime: settlement * u,
                degree: u * 100,
                timeFactor: tv,
                drainagePath: hdr,
                timeFor90: t90,
            };
        },
        chart: (v) => {
            const Hm = v.thickness;
            const settlement =
                v.sigma0 > 0
                    ? Hm *
                      1000 *
                      (v.cc / (1 + v.e0)) *
                      Math.log10((v.sigma0 + v.dSigma) / v.sigma0)
                    : 0;
            const hdr = v.drainage === 0 ? Hm : Hm / 2;
            const tv = hdr > 0 ? (v.cv * v.years) / (hdr * hdr) : 0;

            return settlementTimeChart({
                ultimateSettlementMm: settlement,
                cv: v.cv,
                drainagePath: hdr,
                years: v.years,
                settlementAtTime: settlement * degreeOfConsolidation(tv),
            });
        },
    },

    {
        id: "relative-density",
        name: "Relative Density",
        category: "soil",
        tags: [
            "relative density",
            "density index",
            "void ratio",
            "loose",
            "dense",
            "sand",
        ],
        summary:
            "Relative density of a granular soil from the in-situ, maximum and minimum void ratios.",
        formula: "Dr = (e_max − e) / (e_max − e_min) × 100",
        reference:
            "IS 2720 (Part 14) for the maximum and minimum density tests. Void ratios come from the corresponding dry densities.",
        inputs: [
            {
                key: "emax",
                label: "Maximum void ratio e_max",
                default: 0.9,
                min: 0.2,
                max: 3,
                step: 0.01,
                help: "Corresponds to the loosest state",
            },
            {
                key: "emin",
                label: "Minimum void ratio e_min",
                default: 0.45,
                min: 0.1,
                max: 3,
                step: 0.01,
                help: "Corresponds to the densest state",
            },
            {
                key: "enatural",
                label: "In-situ void ratio e",
                default: 0.6,
                min: 0.1,
                max: 3,
                step: 0.01,
            },
        ],
        outputs: [
            {
                key: "dr",
                label: "Relative density Dr",
                unit: "%",
                decimals: 1,
                hero: true,
            },
            { key: "description", label: "Density description" },
            {
                key: "range",
                label: "Void ratio range (e_max − e_min)",
                decimals: 3,
            },
            {
                key: "engineeringAdvice",
                label: "Typical engineering implication",
            },
        ],
        notes: [
            "Classification: below 15% very loose, 15–35% loose, 35–65% medium, 65–85% dense, above 85% very dense.",
            "Relative density predicts the friction angle and settlement behaviour of sands far better than the void ratio alone.",
            "A higher Dr means a higher φ, a higher bearing capacity and less settlement under load.",
        ],
        compute: (v) => {
            const range = v.emax - v.emin;
            const dr = range > 0 ? ((v.emax - v.enatural) / range) * 100 : 0;
            const clamped = Math.max(Math.min(dr, 100), 0);

            let description: string;
            if (clamped < 15) description = "Very loose";
            else if (clamped < 35) description = "Loose";
            else if (clamped < 65) description = "Medium dense";
            else if (clamped < 85) description = "Dense";
            else description = "Very dense";

            let engineeringAdvice: string;
            if (clamped < 35)
                engineeringAdvice =
                    "Unsuitable as a foundation stratum without compaction or ground improvement — large settlements and liquefaction risk";
            else if (clamped < 65)
                engineeringAdvice =
                    "Acceptable for light structures; expect moderate settlement";
            else
                engineeringAdvice =
                    "Good bearing stratum — suitable for heavy footings with small settlements";

            return { dr: clamped, description, range, engineeringAdvice };
        },
    },
];
