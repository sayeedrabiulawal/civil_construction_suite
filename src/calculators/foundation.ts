import type { Calculator } from "@/core/types";

/**
 * Foundation calculators.
 *
 * Inputs arrive in SI base units: forces in N, pressures in Pa, unit weights in
 * N/m³, lengths in m, angles in radians. Pressures and forces are converted back
 * to the civil-engineering favourites (kN/m² and kN) at the very end, because
 * outputs are displayed exactly as returned.
 */
const TO_KN = 1 / 1000; // N -> kN and Pa -> kN/m²

export const FOUNDATION_CALCULATORS: Calculator[] = [
    {
        id: "isolated-footing-size",
        name: "Isolated Footing Sizing",
        category: "foundation",
        tags: [
            "footing",
            "foundation",
            "isolated",
            "pad",
            "sbc",
            "sizing",
            "bearing",
        ],
        summary:
            "Required footing area and dimensions from column load and safe bearing capacity.",
        formula:
            "Area = (Column load × (1 + self weight %)) ÷ Safe bearing capacity\nSquare side = √Area",
        reference:
            "IS 456:2000 and IS 1904. Footing self weight is usually 10% of the column load.",
        inputs: [
            {
                key: "load",
                label: "Column axial load",
                quantity: "force",
                defaultUnit: "kN",
                default: 800,
                min: 0,
            },
            {
                key: "sbc",
                label: "Safe bearing capacity",
                quantity: "pressure",
                defaultUnit: "kNm2",
                default: 150,
                min: 0,
            },
            {
                key: "selfWeight",
                label: "Footing self weight",
                default: 10,
                min: 0,
                max: 25,
                help: "% of the column load",
            },
            {
                key: "aspect",
                label: "Length : Width ratio",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "1 : 1 (square)" },
                    { value: 1, label: "1.25 : 1" },
                    { value: 2, label: "1.5 : 1" },
                    { value: 3, label: "2 : 1" },
                ],
            },
            {
                key: "roundTo",
                label: "Round dimension up to",
                unit: "mm",
                default: 50,
                min: 1,
                help: "Site-friendly multiples",
            },
        ],
        outputs: [
            {
                key: "area",
                label: "Required footing area",
                unit: "m²",
                decimals: 3,
                hero: true,
            },
            {
                key: "side",
                label: "Square footing side",
                unit: "mm",
                decimals: 0,
            },
            {
                key: "length",
                label: "Rectangular footing length",
                unit: "mm",
                decimals: 0,
            },
            {
                key: "breadth",
                label: "Rectangular footing breadth",
                unit: "mm",
                decimals: 0,
            },
            {
                key: "totalLoad",
                label: "Total service load",
                unit: "kN",
                decimals: 1,
            },
            {
                key: "actualPressure",
                label: "Actual bearing pressure with the rounded size",
                unit: "kN/m²",
                decimals: 1,
            },
        ],
        notes: [
            "Increase the size for eccentric loads or moments, or when the pressure exceeds the safe bearing capacity.",
            "Footing thickness must still be designed for one-way shear, punching shear and bending.",
        ],
        compute: (v) => {
            const aspectRatio = [1, 1.25, 1.5, 2][v.aspect];
            const totalLoadN = v.load * (1 + v.selfWeight / 100); // N
            const area = v.sbc > 0 ? totalLoadN / v.sbc : 0; // m²

            // Area = L × B with L = ratio × B  =>  B = √(Area ÷ ratio)
            const breadthM = Math.sqrt(area / aspectRatio);
            const lengthM = breadthM * aspectRatio;
            const sideM = Math.sqrt(area);

            const step = Math.max(v.roundTo, 1);
            const roundUpMm = (metres: number) =>
                Math.ceil((metres * 1000) / step) * step;

            const lengthMm = roundUpMm(lengthM);
            const breadthMm = roundUpMm(breadthM);
            const providedArea = (lengthMm / 1000) * (breadthMm / 1000);

            return {
                area,
                side: roundUpMm(sideM),
                length: lengthMm,
                breadth: breadthMm,
                totalLoad: totalLoadN * TO_KN,
                actualPressure:
                    providedArea > 0 ? (totalLoadN / providedArea) * TO_KN : 0,
            };
        },
    },

    {
        id: "footing-pressure-check",
        name: "Footing Pressure Check (Eccentric)",
        category: "foundation",
        tags: [
            "footing",
            "pressure",
            "eccentric",
            "pmax",
            "pmin",
            "overturning",
            "moment",
        ],
        summary:
            "Maximum and minimum soil pressure under a footing carrying an axial load and moment.",
        formula: "A = L × B,  Z = B L² / 6\np(max/min) = P/A ± M/Z",
        reference:
            "IS 456:2000 Cl. 34.2.1 — the maximum pressure must not exceed the safe bearing capacity.",
        inputs: [
            {
                key: "load",
                label: "Axial load P (including self weight)",
                quantity: "force",
                defaultUnit: "kN",
                default: 900,
                min: 0,
            },
            {
                key: "moment",
                label: "Bending moment M",
                unit: "kN·m",
                default: 60,
                min: 0,
            },
            {
                key: "length",
                label: "Footing length L (moment direction)",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
            {
                key: "breadth",
                label: "Footing breadth B",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
            {
                key: "sbc",
                label: "Safe bearing capacity",
                quantity: "pressure",
                defaultUnit: "kNm2",
                default: 150,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "pmax",
                label: "Maximum pressure",
                unit: "kN/m²",
                decimals: 2,
                hero: true,
            },
            {
                key: "pmin",
                label: "Minimum pressure",
                unit: "kN/m²",
                decimals: 2,
            },
            {
                key: "pavg",
                label: "Average pressure",
                unit: "kN/m²",
                decimals: 2,
            },
            { key: "area", label: "Footing area", unit: "m²", decimals: 3 },
            {
                key: "z",
                label: "Section modulus Z = B L² / 6",
                unit: "m³",
                decimals: 4,
            },
            {
                key: "utilisation",
                label: "Utilisation of the safe bearing capacity",
                unit: "%",
                decimals: 1,
                help: "Must be 100 or less",
            },
            {
                key: "eccentricity",
                label: "Eccentricity e = M/P",
                unit: "m",
                decimals: 4,
            },
            {
                key: "upliftRatio",
                label: "Eccentricity as a fraction of L/6",
                decimals: 3,
                help: "Above 1.0 means part of the base lifts off",
            },
        ],
        notes: [
            "If e exceeds L/6 the pressure distribution becomes triangular and part of the base loses contact — redesign rather than relying on these numbers.",
            "Pressures are computed from the moment entered in kN·m, converted internally to N·m.",
        ],
        compute: (v) => {
            const momentNm = v.moment * 1000; // kN·m -> N·m
            const area = v.length * v.breadth; // m²
            const z = (v.breadth * v.length * v.length) / 6; // m³

            const avg = area > 0 ? v.load / area : 0; // Pa
            const bending = z > 0 ? momentNm / z : 0; // Pa
            const eccentricity = v.load > 0 ? momentNm / v.load : 0; // m

            return {
                pmax: (avg + bending) * TO_KN,
                pmin: (avg - bending) * TO_KN,
                pavg: avg * TO_KN,
                area,
                z,
                utilisation: v.sbc > 0 ? ((avg + bending) / v.sbc) * 100 : 0,
                eccentricity,
                upliftRatio: v.length > 0 ? eccentricity / (v.length / 6) : 0,
            };
        },
    },

    {
        id: "bearing-capacity-terzaghi",
        name: "Bearing Capacity (Terzaghi)",
        category: "foundation",
        tags: [
            "bearing capacity",
            "terzaghi",
            "qu",
            "foundation",
            "shallow",
            "soil",
        ],
        summary:
            "Ultimate and safe bearing capacity of a shallow strip footing by Terzaghi analysis.",
        formula:
            "Nq = e^(π tanφ) tan²(45 + φ/2)\nNc = (Nq − 1) cot φ\nNγ = 2 (Nq + 1) tan φ\nqu = c Nc + γ Df Nq + 0.5 γ B Nγ",
        reference:
            "Terzaghi (1943). Strip footing — square and circular footings carry shape factors.",
        inputs: [
            {
                key: "cohesion",
                label: "Soil cohesion c",
                quantity: "pressure",
                defaultUnit: "kNm2",
                default: 10,
                min: 0,
            },
            {
                key: "phi",
                label: "Angle of internal friction φ",
                quantity: "angle",
                defaultUnit: "deg",
                default: 30,
                min: 0,
            },
            {
                key: "gamma",
                label: "Soil unit weight γ",
                quantity: "unitWeight",
                defaultUnit: "kNm3",
                default: 18,
                min: 0,
            },
            {
                key: "df",
                label: "Depth of footing Df",
                quantity: "length",
                defaultUnit: "m",
                default: 1.5,
                min: 0,
            },
            {
                key: "b",
                label: "Footing width B",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
            {
                key: "fos",
                label: "Factor of safety",
                default: 3,
                min: 1,
                max: 6,
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
                key: "qu",
                label: "Ultimate gross capacity qu",
                unit: "kN/m²",
                decimals: 1,
            },
            {
                key: "netQu",
                label: "Ultimate net capacity",
                unit: "kN/m²",
                decimals: 1,
            },
            {
                key: "safeGross",
                label: "Gross safe bearing capacity",
                unit: "kN/m²",
                decimals: 1,
            },
            {
                key: "overburden",
                label: "Overburden pressure γ Df",
                unit: "kN/m²",
                decimals: 1,
            },
            { key: "nc", label: "Nc", decimals: 2 },
            { key: "nq", label: "Nq", decimals: 2 },
            { key: "nGamma", label: "Nγ", decimals: 2 },
        ],
        notes: [
            "Terzaghi factors apply to a strip footing. Square and circular footings use reduced cohesion and friction terms.",
            "Account for the water table — the submerged unit weight reduces capacity significantly.",
            "A preliminary check only; confirm with plate load, SPT or laboratory data.",
        ],
        compute: (v) => {
            const phi = v.phi; // radians
            const nq =
                Math.exp(Math.PI * Math.tan(phi)) *
                Math.tan(Math.PI / 4 + phi / 2) ** 2;
            const nc = phi > 0.0001 ? (nq - 1) / Math.tan(phi) : 5.7;
            const ngamma = 2 * (nq + 1) * Math.tan(phi);

            const overburden = v.gamma * v.df; // Pa
            const qu =
                v.cohesion * nc +
                overburden * nq +
                0.5 * v.gamma * v.b * ngamma; // Pa
            const netQu = qu - overburden;
            const safeNet = netQu / Math.max(v.fos, 0.1);

            return {
                safeNet: safeNet * TO_KN,
                qu: qu * TO_KN,
                netQu: netQu * TO_KN,
                safeGross: (safeNet + overburden) * TO_KN,
                overburden: overburden * TO_KN,
                nc,
                nq,
                nGamma: ngamma,
            };
        },
    },

    {
        id: "earth-pressure-rankine",
        name: "Lateral Earth Pressure (Rankine)",
        category: "foundation",
        tags: [
            "earth pressure",
            "rankine",
            "retaining wall",
            "ka",
            "kp",
            "lateral",
            "surcharge",
        ],
        summary:
            "Active and passive earth pressure coefficients and thrust on a retaining wall.",
        formula:
            "Ka = (1 − sin φ) / (1 + sin φ),  Kp = 1 / Ka\nPa = ½ Ka γ H² + Ka q H",
        reference:
            "Rankine theory for a smooth vertical wall with horizontal cohesionless backfill.",
        inputs: [
            {
                key: "phi",
                label: "Angle of internal friction φ",
                quantity: "angle",
                defaultUnit: "deg",
                default: 30,
                min: 0,
            },
            {
                key: "gamma",
                label: "Backfill unit weight γ",
                quantity: "unitWeight",
                defaultUnit: "kNm3",
                default: 18,
                min: 0,
            },
            {
                key: "height",
                label: "Wall height H",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "surcharge",
                label: "Uniform surcharge q",
                quantity: "pressure",
                defaultUnit: "kNm2",
                default: 10,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "pa",
                label: "Total active thrust",
                unit: "kN/m",
                decimals: 2,
                hero: true,
            },
            { key: "ka", label: "Active coefficient Ka", decimals: 4 },
            { key: "kp", label: "Passive coefficient Kp", decimals: 4 },
            {
                key: "paSoil",
                label: "Thrust from the soil alone",
                unit: "kN/m",
                decimals: 2,
            },
            {
                key: "paSurcharge",
                label: "Thrust from the surcharge",
                unit: "kN/m",
                decimals: 2,
            },
            {
                key: "y",
                label: "Height of the resultant above the base",
                unit: "m",
                decimals: 3,
            },
            {
                key: "pmax",
                label: "Pressure at the base",
                unit: "kN/m²",
                decimals: 2,
            },
        ],
        notes: [
            "The passive coefficient applies to soil being pushed into; it is only mobilised by wall movement towards the fill.",
            "Cohesive backfill, sloping ground and a water table all need modified analysis.",
            "Thrusts are per metre length of wall.",
        ],
        compute: (v) => {
            const sinPhi = Math.sin(v.phi);
            const ka = (1 - sinPhi) / (1 + sinPhi);
            const kp = ka > 0 ? 1 / ka : 0;

            const paSoil = 0.5 * ka * v.gamma * v.height * v.height; // N/m
            const paSurcharge = ka * v.surcharge * v.height; // N/m
            const total = paSoil + paSurcharge;

            // Resultant height: the soil triangle acts at H/3, the surcharge rectangle at H/2.
            const y =
                total > 0
                    ? (paSoil * (v.height / 3) + paSurcharge * (v.height / 2)) /
                      total
                    : 0;

            return {
                pa: total * TO_KN,
                ka,
                kp,
                paSoil: paSoil * TO_KN,
                paSurcharge: paSurcharge * TO_KN,
                y,
                pmax: (ka * v.gamma * v.height + ka * v.surcharge) * TO_KN,
            };
        },
    },

    {
        id: "pile-capacity",
        name: "Pile Load Capacity",
        category: "foundation",
        tags: [
            "pile",
            "capacity",
            "end bearing",
            "skin friction",
            "bored pile",
            "driven pile",
            "deep foundation",
        ],
        summary:
            "Ultimate and safe load capacity of a single pile from end bearing and skin friction.",
        formula:
            "Cohesive:  qb = 9c,  fs = α c\nCohesionless:  qb = σ′v Nq,  fs = K σ′v,avg tan δ\nQu = qb Ab + fs As",
        reference:
            "IS 2911 (Part 1). Nq after Terzaghi; δ is taken as 0.75φ and K as 1.0 for a bored pile.",
        inputs: [
            {
                key: "dia",
                label: "Pile diameter",
                quantity: "length",
                defaultUnit: "mm",
                default: 500,
                allowedUnits: ["mm", "cm", "m"],
                min: 0,
            },
            {
                key: "length",
                label: "Pile length embedded in the bearing stratum",
                quantity: "length",
                defaultUnit: "m",
                default: 10,
                min: 0,
            },
            {
                key: "soil",
                label: "Soil type",
                kind: "select",
                default: 1,
                options: [
                    { value: 0, label: "Cohesive (clay)" },
                    { value: 1, label: "Cohesionless (sand / gravel)" },
                ],
            },
            {
                key: "cohesion",
                label: "Undrained cohesion cu",
                unit: "kN/m²",
                default: 50,
                min: 0,
                help: "Used for cohesive soil only",
            },
            {
                key: "phi",
                label: "Angle of internal friction φ",
                quantity: "angle",
                defaultUnit: "deg",
                default: 32,
                min: 0,
                help: "Used for cohesionless soil only",
            },
            {
                key: "gamma",
                label: "Effective unit weight of the soil",
                quantity: "unitWeight",
                defaultUnit: "kNm3",
                default: 10,
                min: 0,
                help: "Use the submerged unit weight below the water table",
            },
            {
                key: "alpha",
                label: "Adhesion factor α",
                default: 0.5,
                min: 0.2,
                max: 1,
                step: 0.05,
                help: "Typical 0.4–0.6 for a bored pile in stiff clay",
            },
            {
                key: "fos",
                label: "Factor of safety",
                default: 2.5,
                min: 1.5,
                max: 4,
                step: 0.1,
            },
        ],
        outputs: [
            {
                key: "safe",
                label: "Safe load capacity",
                unit: "kN",
                decimals: 1,
                hero: true,
            },
            {
                key: "ultimate",
                label: "Ultimate capacity Qu",
                unit: "kN",
                decimals: 1,
            },
            {
                key: "endBearing",
                label: "End bearing contribution",
                unit: "kN",
                decimals: 1,
            },
            {
                key: "skinFriction",
                label: "Skin friction contribution",
                unit: "kN",
                decimals: 1,
            },
            {
                key: "frictionShare",
                label: "Share carried by skin friction",
                unit: "%",
                decimals: 1,
            },
            { key: "baseArea", label: "Base area Ab", unit: "m²", decimals: 4 },
            {
                key: "surfaceArea",
                label: "Shaft surface area As",
                unit: "m²",
                decimals: 2,
            },
            {
                key: "qbUnit",
                label: "Unit end bearing qb",
                unit: "kN/m²",
                decimals: 1,
            },
            {
                key: "fsUnit",
                label: "Average unit skin friction fs",
                unit: "kN/m²",
                decimals: 2,
            },
        ],
        notes: [
            "The unit end bearing in sand is capped at 11,000 kN/m², a customary limiting value.",
            "Skin friction in clay is capped at 100 kN/m².",
            "This is a static-formula estimate. Load test results always govern in practice.",
            "Subtract the pile self weight and account for negative skin friction in settling fill.",
            "Piles in a group carry less than the sum of the individual capacities — apply a group efficiency factor.",
        ],
        compute: (v) => {
            const D = v.dia; // m
            const L = v.length; // m
            const Ab = (Math.PI / 4) * D * D; // m²
            const As = Math.PI * D * L; // m²

            let qb: number; // Pa
            let fs: number; // Pa

            if (v.soil === 0) {
                qb = Math.min(9 * v.cohesion, 100000);
                fs = Math.min(v.alpha * v.cohesion, 100000);
            } else {
                const phi = v.phi;
                const nq =
                    Math.exp(Math.PI * Math.tan(phi)) *
                    Math.tan(Math.PI / 4 + phi / 2) ** 2;
                qb = Math.min(v.gamma * L * nq, 11000000);
                const delta = 0.75 * phi;
                fs = v.gamma * (L / 2) * Math.tan(delta);
            }

            const qbForce = qb * Ab;
            const fsForce = fs * As;
            const ultimate = qbForce + fsForce;

            return {
                ultimate: ultimate * TO_KN,
                safe: (ultimate / Math.max(v.fos, 0.1)) * TO_KN,
                endBearing: qbForce * TO_KN,
                skinFriction: fsForce * TO_KN,
                frictionShare: ultimate > 0 ? (fsForce / ultimate) * 100 : 0,
                baseArea: Ab,
                surfaceArea: As,
                qbUnit: qb * TO_KN,
                fsUnit: fs * TO_KN,
            };
        },
    },

    {
        id: "retaining-wall-stability",
        name: "Retaining Wall Stability Check",
        category: "foundation",
        tags: [
            "retaining wall",
            "stability",
            "overturning",
            "sliding",
            "factor of safety",
            "cantilever wall",
            "earth pressure",
        ],
        summary:
            "Factors of safety against overturning and sliding for a cantilever retaining wall.",
        formula:
            "Ka = (1 − sin φ) / (1 + sin φ)\nPa = ½ Ka γ H² + Ka q H\nFoS overturning = resisting moment ÷ overturning moment\nFoS sliding = μ W ÷ Pa",
        reference:
            "IS 1904 and standard retaining wall practice. Typically FoS ≥ 1.5 for both, often 2.0 for overturning.",
        inputs: [
            {
                key: "height",
                label: "Retained height H above the base",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "baseWidth",
                label: "Base slab width B",
                quantity: "length",
                defaultUnit: "m",
                default: 2.5,
                min: 0,
            },
            {
                key: "baseThickness",
                label: "Base slab thickness",
                quantity: "length",
                defaultUnit: "m",
                default: 0.4,
                min: 0,
            },
            {
                key: "stemThickness",
                label: "Stem thickness at the base",
                quantity: "length",
                defaultUnit: "m",
                default: 0.3,
                min: 0,
            },
            {
                key: "phi",
                label: "Backfill friction angle φ",
                quantity: "angle",
                defaultUnit: "deg",
                default: 30,
                min: 0,
            },
            {
                key: "gammaBackfill",
                label: "Backfill unit weight",
                quantity: "unitWeight",
                defaultUnit: "kNm3",
                default: 18,
                min: 0,
            },
            {
                key: "gammaConcrete",
                label: "Concrete unit weight",
                quantity: "unitWeight",
                defaultUnit: "kNm3",
                default: 24,
                min: 0,
            },
            {
                key: "surcharge",
                label: "Uniform surcharge on the backfill",
                unit: "kN/m²",
                default: 10,
                min: 0,
            },
            {
                key: "mu",
                label: "Base friction coefficient μ",
                default: 0.5,
                min: 0.1,
                max: 0.8,
                step: 0.05,
                help: "Around 0.5 for concrete on sand, 0.35 for clay",
            },
            {
                key: "targetOverturning",
                label: "Target FoS against overturning",
                default: 2,
                min: 1.2,
                max: 3,
                step: 0.1,
            },
            {
                key: "targetSliding",
                label: "Target FoS against sliding",
                default: 1.5,
                min: 1.2,
                max: 3,
                step: 0.1,
            },
        ],
        outputs: [
            {
                key: "fosOverturning",
                label: "FoS against overturning",
                decimals: 2,
                hero: true,
            },
            { key: "fosSliding", label: "FoS against sliding", decimals: 2 },
            { key: "verdict", label: "Verdict" },
            { key: "ka", label: "Active coefficient Ka", decimals: 4 },
            { key: "pa", label: "Active thrust Pa", unit: "kN/m", decimals: 2 },
            {
                key: "overturningMoment",
                label: "Overturning moment about the toe",
                unit: "kN·m/m",
                decimals: 2,
            },
            {
                key: "restoringMoment",
                label: "Restoring moment about the toe",
                unit: "kN·m/m",
                decimals: 2,
            },
            {
                key: "totalWeight",
                label: "Total wall weight",
                unit: "kN/m",
                decimals: 2,
            },
            {
                key: "leverArm",
                label: "Height of the thrust above the toe",
                unit: "m",
                decimals: 3,
            },
        ],
        notes: [
            "The wall is idealised as a base slab plus a rectangular stem. Soil resting on the heel is ignored, which understates the restoring moment and is therefore safe.",
            "All results are per metre length of wall.",
            "A tapered stem, a sloping base or a key will change the answer — use this as a first sizing check.",
            "Also check the bearing pressure under the base and the global slope stability.",
            "A taller wall usually needs a wider base: B is typically 0.5–0.7 H.",
        ],
        compute: (v) => {
            const sinPhi = Math.sin(v.phi);
            const ka = (1 - sinPhi) / (1 + sinPhi);

            const H = v.height;
            const B = v.baseWidth;
            const t = v.baseThickness;
            const stemT = v.stemThickness;

            // The surcharge enters in kN/m², but everything else here is in SI (N, m),
            // so convert it to pascals before using it.
            const surchargePa = v.surcharge * 1000;

            // Active thrust per metre of wall (N/m).
            const paSoil = 0.5 * ka * v.gammaBackfill * H * H;
            const paSurcharge = ka * surchargePa * H;
            const pa = paSoil + paSurcharge;

            // Soil thrust acts at H/3; the surcharge component at H/2.
            const leverFromBaseTop =
                pa > 0 ? (paSoil * (H / 3) + paSurcharge * (H / 2)) / pa : 0;
            const leverFromToe = leverFromBaseTop + t;

            const overturningMoment = pa * leverFromToe;

            // Restoring: base slab about B/2, stem about (B − stemT/2) from the toe.
            const baseWeight = B * t * v.gammaConcrete;
            const stemWeight = stemT * H * v.gammaConcrete;
            const totalWeight = baseWeight + stemWeight;
            const restoringMoment =
                baseWeight * (B / 2) + stemWeight * (B - stemT / 2);

            const fosOverturning =
                overturningMoment > 0 ? restoringMoment / overturningMoment : 0;
            const fosSliding = pa > 0 ? (v.mu * totalWeight) / pa : 0;

            const okOverturn = fosOverturning >= v.targetOverturning;
            const okSliding = fosSliding >= v.targetSliding;

            return {
                fosOverturning,
                fosSliding,
                ka,
                pa: pa * TO_KN,
                overturningMoment: overturningMoment * TO_KN,
                restoringMoment: restoringMoment * TO_KN,
                totalWeight: totalWeight * TO_KN,
                leverArm: leverFromToe,
                verdict:
                    okOverturn && okSliding
                        ? "PASS — both factors of safety meet the targets"
                        : !okOverturn && !okSliding
                          ? "FAIL — both overturning and sliding are inadequate; widen the base"
                          : !okOverturn
                            ? "FAIL — insufficient resistance to overturning; widen or thicken the base"
                            : "FAIL — insufficient resistance to sliding; add a shear key or widen the base",
            };
        },
    },
];
