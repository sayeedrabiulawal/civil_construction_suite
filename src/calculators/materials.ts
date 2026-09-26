import type { Calculator } from "@/core/types";
import {
    BAG_KG,
    CEMENT_DENSITY,
    MORTAR_OPTIONS,
    MORTAR_RATIOS,
    SAND_DENSITY,
} from "./shared";

/** Modular, traditional and Bangladesh brick sizes, in metres. */
const BRICK_SIZES: {
    value: number;
    label: string;
    dims: [number, number, number];
}[] = [
    { value: 0, label: "Modular 190 × 90 × 90 mm", dims: [0.19, 0.09, 0.09] },
    {
        value: 1,
        label: "Traditional 230 × 110 × 75 mm",
        dims: [0.23, 0.11, 0.075],
    },
    {
        value: 2,
        label: "Bangladesh 240 × 115 × 70 mm",
        dims: [0.24, 0.115, 0.07],
    },
];

export const MATERIAL_CALCULATORS: Calculator[] = [
    {
        id: "brick-masonry",
        name: "Brick Masonry Calculator",
        category: "materials",
        tags: ["brick", "masonry", "wall", "mortar", "blocks", "nos"],
        summary:
            "Number of bricks, mortar volume, cement bags and sand for a brick wall.",
        formula:
            "Bricks = Volume × (1 / ((l+j)(w+j)(h+j))) × (1 + wastage)\nMortar = Wall volume − Solid brick volume\nCement bags = (Dry mortar × ratio share × 1440) / 50",
        reference:
            "Standard practice with 10 mm mortar joints; dry volume factor 1.33.",
        inputs: [
            {
                key: "length",
                label: "Wall length",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "height",
                label: "Wall height",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
            {
                key: "thickness",
                label: "Wall thickness",
                quantity: "length",
                defaultUnit: "mm",
                default: 230,
                allowedUnits: ["mm", "cm", "m", "in"],
            },
            {
                key: "size",
                label: "Brick size",
                kind: "select",
                default: 0,
                options: BRICK_SIZES.map((b) => ({
                    value: b.value,
                    label: b.label,
                })),
            },
            {
                key: "joint",
                label: "Mortar joint",
                quantity: "length",
                defaultUnit: "mm",
                default: 10,
                allowedUnits: ["mm", "cm"],
            },
            {
                key: "ratio",
                label: "Mortar ratio (cement : sand)",
                kind: "select",
                default: 3,
                options: MORTAR_OPTIONS,
            },
            {
                key: "wastage",
                label: "Wastage",
                kind: "number",
                default: 5,
                min: 0,
                max: 30,
                help: "Typically 5–10%",
            },
        ],
        outputs: [
            {
                key: "bricks",
                label: "Bricks required",
                decimals: 0,
                hero: true,
            },
            {
                key: "bricksOrder",
                label: "Bricks to order (rounded up)",
                decimals: 0,
            },
            {
                key: "mortar",
                label: "Wet mortar volume",
                quantity: "volume",
                unit: "m3",
            },
            {
                key: "dryMortar",
                label: "Dry mortar volume",
                quantity: "volume",
                unit: "m3",
            },
            { key: "cementBags", label: "Cement", unit: "bags", decimals: 1 },
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
                key: "water",
                label: "Water (w/c 0.5)",
                quantity: "volume",
                unit: "L",
                decimals: 0,
            },
            {
                key: "wallArea",
                label: "Wall face area",
                quantity: "area",
                unit: "m2",
            },
        ],
        notes: [
            "Bricks are counted as whole units; always order the rounded-up quantity.",
            "Assumes 10 mm mortar joints and a 33% bulking allowance on dry mortar.",
        ],
        compute: (v) => {
            const dims = BRICK_SIZES[v.size].dims;
            const j = v.joint;
            const perM3 = 1 / ((dims[0] + j) * (dims[1] + j) * (dims[2] + j));

            const wallVolume = v.length * v.height * v.thickness;
            const bricksPlain = wallVolume * perM3;
            const bricksTotal = bricksPlain * (1 + v.wastage / 100);

            const solidBrickVolume = bricksPlain * dims[0] * dims[1] * dims[2];
            const wetMortar = Math.max(wallVolume - solidBrickVolume, 0);
            const dryMortar = wetMortar * 1.33;

            const r = MORTAR_RATIOS[v.ratio];
            const parts = r.cement + r.sand;
            const cementVolume = (dryMortar * r.cement) / parts;
            const sandVolume = (dryMortar * r.sand) / parts;
            const cementKg = cementVolume * CEMENT_DENSITY;

            return {
                bricks: bricksTotal,
                bricksOrder: Math.ceil(bricksTotal),
                mortar: wetMortar,
                dryMortar,
                cementBags: cementKg / BAG_KG,
                cementKg,
                sandM3: sandVolume,
                sandKg: sandVolume * SAND_DENSITY,
                water: cementKg * 0.5,
                wallArea: v.length * v.height,
            };
        },
    },

    {
        id: "plaster",
        name: "Plaster / Render Calculator",
        category: "materials",
        tags: ["plaster", "render", "mortar", "cement", "sand", "wall finish"],
        summary: "Cement and sand required to plaster a wall or ceiling.",
        formula:
            "Wet volume = Area × Thickness\nDry volume = Wet volume × 1.33 (+ wastage)\nCement bags = (Dry volume × cement share × 1440) / 50",
        reference:
            "IS 1661 / standard site practice. 12 mm internal, 20 mm external plaster.",
        inputs: [
            {
                key: "area",
                label: "Plaster area",
                quantity: "area",
                defaultUnit: "m2",
                default: 100,
                min: 0,
            },
            {
                key: "thickness",
                label: "Plaster thickness",
                quantity: "length",
                defaultUnit: "mm",
                default: 12,
                allowedUnits: ["mm", "cm", "in"],
            },
            {
                key: "ratio",
                label: "Mortar ratio (cement : sand)",
                kind: "select",
                default: 3,
                options: MORTAR_OPTIONS,
            },
            { key: "wastage", label: "Wastage", default: 10, min: 0, max: 40 },
            {
                key: "wc",
                label: "Water-cement ratio",
                default: 0.5,
                min: 0.3,
                max: 0.8,
                step: 0.05,
            },
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
                key: "dryVolume",
                label: "Dry mortar volume",
                quantity: "volume",
                unit: "m3",
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
            "Use a richer mix (1:3 or 1:4) for external plaster and 1:5–1:6 for internal plaster.",
            "Add extra material when plastering over rough or uneven surfaces.",
        ],
        compute: (v) => {
            const wet = v.area * v.thickness;
            const dry = wet * 1.33 * (1 + v.wastage / 100);
            const r = MORTAR_RATIOS[v.ratio];
            const parts = r.cement + r.sand;
            const cementVolume = (dry * r.cement) / parts;
            const sandVolume = (dry * r.sand) / parts;
            const cementKg = cementVolume * CEMENT_DENSITY;
            return {
                cementBags: cementKg / BAG_KG,
                cementKg,
                sandM3: sandVolume,
                sandKg: sandVolume * SAND_DENSITY,
                dryVolume: dry,
                water: cementKg * v.wc,
            };
        },
    },

    {
        id: "mortar-mix",
        name: "Cement Mortar Mix",
        category: "materials",
        tags: ["mortar", "cement", "sand", "mix", "bedding", "jointing"],
        summary: "Cement, sand and water for a given volume of cement mortar.",
        formula:
            "Dry volume = Wet volume × 1.33\nCement = Dry volume × (cement / total parts)",
        inputs: [
            {
                key: "volume",
                label: "Wet volume of mortar",
                quantity: "volume",
                defaultUnit: "m3",
                default: 1,
                min: 0,
            },
            {
                key: "ratio",
                label: "Mix ratio (cement : sand)",
                kind: "select",
                default: 2,
                options: MORTAR_OPTIONS,
            },
            {
                key: "dryFactor",
                label: "Dry volume factor",
                default: 1.33,
                min: 1,
                max: 2,
                step: 0.01,
            },
            {
                key: "wc",
                label: "Water-cement ratio",
                default: 0.5,
                min: 0.3,
                max: 0.9,
                step: 0.05,
            },
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
        ],
        compute: (v) => {
            const dry = v.volume * v.dryFactor;
            const r = MORTAR_RATIOS[v.ratio];
            const parts = r.cement + r.sand;
            const cementVolume = (dry * r.cement) / parts;
            const sandVolume = (dry * r.sand) / parts;
            const cementKg = cementVolume * CEMENT_DENSITY;
            return {
                cementBags: cementKg / BAG_KG,
                cementKg,
                sandM3: sandVolume,
                sandKg: sandVolume * SAND_DENSITY,
                water: cementKg * v.wc,
                dryVolume: dry,
            };
        },
    },

    {
        id: "paint",
        name: "Paint Quantity Calculator",
        category: "materials",
        tags: ["paint", "primer", "coats", "litre", "painting", "coverage"],
        summary: "Litres of paint and number of containers needed for an area.",
        formula: "Litres = (Area × Coats ÷ Coverage) × (1 + wastage)",
        inputs: [
            {
                key: "area",
                label: "Paintable area",
                quantity: "area",
                defaultUnit: "m2",
                default: 100,
                min: 0,
            },
            {
                key: "coats",
                label: "Number of coats",
                default: 2,
                min: 1,
                max: 5,
                step: 1,
            },
            {
                key: "coverage",
                label: "Coverage",
                default: 10,
                min: 1,
                help: "m² covered by 1 litre in one coat. Typically 8–12 m²/L for emulsion, 12–16 for primer.",
            },
            { key: "wastage", label: "Wastage", default: 5, min: 0, max: 30 },
            {
                key: "container",
                label: "Container size",
                default: 20,
                min: 1,
                help: "Litres per pack (1, 4, 10, 20)",
            },
        ],
        outputs: [
            {
                key: "litres",
                label: "Paint required",
                quantity: "volume",
                unit: "L",
                decimals: 1,
                hero: true,
            },
            { key: "containerCount", label: "Containers to buy", decimals: 0 },
            {
                key: "litresPerCoat",
                label: "Paint per coat",
                quantity: "volume",
                unit: "L",
                decimals: 1,
            },
        ],
        notes: [
            "Deduct doors and windows before entering the area where practical.",
        ],
        compute: (v) => {
            // Guard both divisors: a zero coverage or pack size would give Infinity.
            const perCoat = v.coverage > 0 ? v.area / v.coverage : 0;
            const litres = perCoat * v.coats * (1 + v.wastage / 100);
            return {
                litres,
                containerCount:
                    v.container > 0 ? Math.ceil(litres / v.container) : 0,
                litresPerCoat: perCoat,
            };
        },
    },

    {
        id: "tiles",
        name: "Tiles & Adhesive Calculator",
        category: "materials",
        tags: [
            "tile",
            "flooring",
            "adhesive",
            "skirting",
            "ceramic",
            "vitrified",
        ],
        summary: "Number of tiles and adhesive required for a floor or wall.",
        formula: "Tiles = (Floor area ÷ Tile area) × (1 + wastage)",
        reference:
            "Standard tile adhesive consumption ≈ 3–5 kg/m² for a 3 mm bed.",
        inputs: [
            {
                key: "roomLength",
                label: "Room length",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "roomWidth",
                label: "Room width",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "tileLength",
                label: "Tile length",
                quantity: "length",
                defaultUnit: "mm",
                default: 600,
                allowedUnits: ["mm", "cm", "in"],
            },
            {
                key: "tileWidth",
                label: "Tile width",
                quantity: "length",
                defaultUnit: "mm",
                default: 600,
                allowedUnits: ["mm", "cm", "in"],
            },
            {
                key: "wastage",
                label: "Wastage / cutting",
                default: 8,
                min: 0,
                max: 30,
            },
            {
                key: "adhesiveRate",
                label: "Adhesive consumption",
                default: 4,
                min: 0,
                help: "kg per m²",
            },
        ],
        outputs: [
            { key: "tiles", label: "Tiles required", decimals: 0, hero: true },
            {
                key: "tilesBoxes",
                label: "Tiles to order (nearest higher)",
                decimals: 0,
            },
            {
                key: "floorArea",
                label: "Floor area",
                quantity: "area",
                unit: "m2",
            },
            {
                key: "tileArea",
                label: "One tile area",
                quantity: "area",
                unit: "m2",
                decimals: 4,
            },
            {
                key: "adhesive",
                label: "Tile adhesive",
                quantity: "mass",
                unit: "kg",
                decimals: 0,
            },
            {
                key: "adhesiveBags",
                label: "Adhesive bags (20 kg)",
                decimals: 0,
            },
        ],
        compute: (v) => {
            const floorArea = v.roomLength * v.roomWidth;
            const tileArea = v.tileLength * v.tileWidth;
            const tiles =
                tileArea > 0
                    ? (floorArea / tileArea) * (1 + v.wastage / 100)
                    : 0;
            const adhesive = floorArea * v.adhesiveRate;
            return {
                tiles,
                tilesBoxes: Math.ceil(tiles),
                floorArea,
                tileArea,
                adhesive,
                adhesiveBags: Math.ceil(adhesive / 20),
            };
        },
    },

    {
        id: "concrete-block-masonry",
        name: "Concrete Block Wall Calculator",
        category: "materials",
        tags: ["block", "hollow block", "cmu", "masonry", "wall", "aac"],
        summary:
            "Number of concrete or AAC blocks and mortar for a block wall.",
        formula: "Blocks = Volume ÷ ((l + j)(h + j) × thickness)",
        inputs: [
            {
                key: "length",
                label: "Wall length",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "height",
                label: "Wall height",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
            {
                key: "blockLength",
                label: "Block length",
                quantity: "length",
                defaultUnit: "mm",
                default: 400,
                allowedUnits: ["mm", "cm", "in"],
            },
            {
                key: "blockHeight",
                label: "Block height",
                quantity: "length",
                defaultUnit: "mm",
                default: 200,
                allowedUnits: ["mm", "cm", "in"],
            },
            {
                key: "blockThickness",
                label: "Block thickness",
                quantity: "length",
                defaultUnit: "mm",
                default: 200,
                allowedUnits: ["mm", "cm", "in"],
            },
            {
                key: "joint",
                label: "Mortar joint",
                quantity: "length",
                defaultUnit: "mm",
                default: 10,
                allowedUnits: ["mm", "cm"],
            },
            {
                key: "ratio",
                label: "Mortar ratio (cement : sand)",
                kind: "select",
                default: 1,
                options: MORTAR_OPTIONS,
            },
            { key: "wastage", label: "Wastage", default: 5, min: 0, max: 30 },
        ],
        outputs: [
            {
                key: "blocks",
                label: "Blocks required",
                decimals: 0,
                hero: true,
            },
            {
                key: "mortar",
                label: "Mortar volume (wet)",
                quantity: "volume",
                unit: "m3",
            },
            { key: "cementBags", label: "Cement", unit: "bags", decimals: 1 },
            {
                key: "sandM3",
                label: "Sand volume",
                quantity: "volume",
                unit: "m3",
            },
            {
                key: "wallArea",
                label: "Wall face area",
                quantity: "area",
                unit: "m2",
            },
        ],
        compute: (v) => {
            const blockVol = v.blockLength * v.blockHeight * v.blockThickness;

            // Blocks are counted over the face, so the mortar joint adds to each block's footprint.
            const areaPerBlockWithJoint =
                (v.blockLength + v.joint) * (v.blockHeight + v.joint);
            const faceArea = v.length * v.height;
            const blocksWithWastage =
                areaPerBlockWithJoint > 0
                    ? (faceArea / areaPerBlockWithJoint) * (1 + v.wastage / 100)
                    : 0;
            const blocksPlain = blocksWithWastage / (1 + v.wastage / 100);

            // Mortar fills everything the solid blocks do not.
            const wallVolume = faceArea * v.blockThickness;
            const solidBlockVolume = blocksPlain * blockVol;
            const wetMortar = Math.max(wallVolume - solidBlockVolume, 0);
            const dryMortar = wetMortar * 1.33;

            const r = MORTAR_RATIOS[v.ratio];
            const parts = r.cement + r.sand;
            const cementKg = ((dryMortar * r.cement) / parts) * CEMENT_DENSITY;

            return {
                blocks: blocksWithWastage,
                mortar: wetMortar,
                cementBags: cementKg / BAG_KG,
                sandM3: (dryMortar * r.sand) / parts,
                wallArea: faceArea,
            };
        },
    },
];
