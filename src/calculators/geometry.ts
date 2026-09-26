import type { Calculator } from "@/core/types";

/**
 * Areas & Volumes.
 * Inputs arrive in SI base units (m, m², m³). Outputs are returned already in the
 * unit named on each output field — the engine does not convert them.
 */
const FT2_PER_M2 = 1 / 0.09290304;

export const GEOMETRY_CALCULATORS: Calculator[] = [
    {
        id: "rectangle-area",
        name: "Rectangle / Square Area",
        category: "geometry",
        tags: ["area", "rectangle", "square", "plot", "land"],
        summary: "Area and perimeter of a rectangle or square.",
        formula: "Area = Length × Width   |   Perimeter = 2 × (Length + Width)",
        inputs: [
            {
                key: "length",
                label: "Length",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "width",
                label: "Width",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
        ],
        outputs: [
            { key: "area", label: "Area", unit: "m²", decimals: 3, hero: true },
            { key: "areaFt", label: "Area", unit: "ft²", decimals: 2 },
            { key: "perimeter", label: "Perimeter", unit: "m", decimals: 3 },
        ],
        compute: (v) => {
            const area = v.length * v.width;
            return {
                area,
                areaFt: area * FT2_PER_M2,
                perimeter: 2 * (v.length + v.width),
            };
        },
    },

    {
        id: "circle-area",
        name: "Circle Area & Circumference",
        category: "geometry",
        tags: ["area", "circle", "round", "circumference", "radius", "column"],
        summary: "Area, circumference and diameter of a circle.",
        formula: "Area = π × r²   |   Circumference = 2 × π × r",
        inputs: [
            {
                key: "input",
                label: "Input type",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "Radius" },
                    { value: 1, label: "Diameter" },
                ],
            },
            {
                key: "size",
                label: "Radius / Diameter",
                quantity: "length",
                defaultUnit: "m",
                default: 1,
                min: 0,
            },
        ],
        outputs: [
            { key: "area", label: "Area", unit: "m²", decimals: 4, hero: true },
            {
                key: "circumference",
                label: "Circumference",
                unit: "m",
                decimals: 4,
            },
            { key: "diameter", label: "Diameter", unit: "m", decimals: 4 },
            { key: "radius", label: "Radius", unit: "mm", decimals: 1 },
        ],
        compute: (v) => {
            const r = v.input === 0 ? v.size : v.size / 2;
            return {
                area: Math.PI * r * r,
                circumference: 2 * Math.PI * r,
                diameter: r * 2,
                radius: r * 1000,
            };
        },
    },

    {
        id: "triangle-area",
        name: "Triangle Area (Base & Height)",
        category: "geometry",
        tags: ["area", "triangle", "base", "height"],
        summary: "Area of a triangle from base and perpendicular height.",
        formula: "Area = ½ × Base × Height",
        inputs: [
            {
                key: "base",
                label: "Base",
                quantity: "length",
                defaultUnit: "m",
                default: 6,
                min: 0,
            },
            {
                key: "height",
                label: "Height",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
        ],
        outputs: [
            { key: "area", label: "Area", unit: "m²", decimals: 3, hero: true },
        ],
        compute: (v) => ({ area: 0.5 * v.base * v.height }),
    },

    {
        id: "triangle-heron",
        name: "Triangle Area (Three Sides)",
        category: "geometry",
        tags: ["heron", "triangle", "area", "three sides", "sss"],
        summary:
            "Area of a triangle from all three sides using Heron's formula.",
        formula: "s = (a+b+c)/2   |   Area = √(s(s−a)(s−b)(s−c))",
        inputs: [
            {
                key: "a",
                label: "Side a",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
            {
                key: "b",
                label: "Side b",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "c",
                label: "Side c",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
        ],
        outputs: [
            { key: "area", label: "Area", unit: "m²", decimals: 3, hero: true },
            { key: "s", label: "Semi-perimeter", unit: "m", decimals: 3 },
            { key: "perimeter", label: "Perimeter", unit: "m", decimals: 3 },
        ],
        notes: [
            "The three sides must satisfy the triangle inequality, otherwise the area is not a real number.",
        ],
        compute: (v) => {
            const s = (v.a + v.b + v.c) / 2;
            const t = s * (s - v.a) * (s - v.b) * (s - v.c);
            return {
                area: t > 0 ? Math.sqrt(t) : NaN,
                s,
                perimeter: v.a + v.b + v.c,
            };
        },
    },

    {
        id: "trapezoid-area",
        name: "Trapezoid Area",
        category: "geometry",
        tags: ["area", "trapezoid", "trapezium", "parallel sides"],
        summary:
            "Area of a trapezoid from two parallel sides and the height between them.",
        formula: "Area = ½ × (a + b) × h",
        inputs: [
            {
                key: "a",
                label: "Parallel side a",
                quantity: "length",
                defaultUnit: "m",
                default: 8,
                min: 0,
            },
            {
                key: "b",
                label: "Parallel side b",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "h",
                label: "Height between them",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
        ],
        outputs: [
            { key: "area", label: "Area", unit: "m²", decimals: 3, hero: true },
        ],
        compute: (v) => ({ area: 0.5 * (v.a + v.b) * v.h }),
    },

    {
        id: "parallelogram-area",
        name: "Parallelogram Area",
        category: "geometry",
        tags: ["area", "parallelogram"],
        summary: "Area of a parallelogram from base and height.",
        formula: "Area = Base × Height",
        inputs: [
            {
                key: "base",
                label: "Base",
                quantity: "length",
                defaultUnit: "m",
                default: 5,
                min: 0,
            },
            {
                key: "height",
                label: "Height",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
        ],
        outputs: [
            { key: "area", label: "Area", unit: "m²", decimals: 3, hero: true },
        ],
        compute: (v) => ({ area: v.base * v.height }),
    },

    {
        id: "cuboid-volume",
        name: "Cuboid / Box Volume",
        category: "geometry",
        tags: ["volume", "cuboid", "box", "rectangular", "tank"],
        summary: "Volume and surface area of a rectangular box.",
        formula: "Volume = L × W × H",
        inputs: [
            {
                key: "l",
                label: "Length",
                quantity: "length",
                defaultUnit: "m",
                default: 4,
                min: 0,
            },
            {
                key: "w",
                label: "Width",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
            {
                key: "h",
                label: "Height",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "volume",
                label: "Volume",
                unit: "m³",
                decimals: 3,
                hero: true,
            },
            { key: "litres", label: "Capacity", unit: "litre", decimals: 1 },
            { key: "surface", label: "Surface area", unit: "m²", decimals: 3 },
        ],
        compute: (v) => {
            const { l, w, h } = v;
            return {
                volume: l * w * h,
                litres: l * w * h * 1000,
                surface: 2 * (l * w + w * h + h * l),
            };
        },
    },

    {
        id: "cylinder-volume",
        name: "Cylinder Volume",
        category: "geometry",
        tags: ["volume", "cylinder", "round", "tank", "column", "pile"],
        summary:
            "Volume, lateral surface and total surface of a cylinder or round column.",
        formula: "Volume = π × r² × h",
        inputs: [
            {
                key: "dia",
                label: "Diameter",
                quantity: "length",
                defaultUnit: "m",
                default: 0.5,
                min: 0,
            },
            {
                key: "h",
                label: "Height / Length",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "volume",
                label: "Volume",
                unit: "m³",
                decimals: 4,
                hero: true,
            },
            { key: "litres", label: "Capacity", unit: "litre", decimals: 1 },
            {
                key: "lateral",
                label: "Lateral surface",
                unit: "m²",
                decimals: 3,
            },
            { key: "total", label: "Total surface", unit: "m²", decimals: 3 },
        ],
        compute: (v) => {
            const r = v.dia / 2;
            const volume = Math.PI * r * r * v.h;
            return {
                volume,
                litres: volume * 1000,
                lateral: 2 * Math.PI * r * v.h,
                total: 2 * Math.PI * r * (r + v.h),
            };
        },
    },

    {
        id: "sphere-volume",
        name: "Sphere Volume",
        category: "geometry",
        tags: ["volume", "sphere", "ball", "dome"],
        summary: "Volume and surface area of a sphere.",
        formula: "Volume = (4/3) × π × r³   |   Surface = 4 × π × r²",
        inputs: [
            {
                key: "dia",
                label: "Diameter",
                quantity: "length",
                defaultUnit: "m",
                default: 1,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "volume",
                label: "Volume",
                unit: "m³",
                decimals: 4,
                hero: true,
            },
            { key: "surface", label: "Surface area", unit: "m²", decimals: 4 },
        ],
        compute: (v) => {
            const r = v.dia / 2;
            return {
                volume: (4 / 3) * Math.PI * r ** 3,
                surface: 4 * Math.PI * r * r,
            };
        },
    },

    {
        id: "cone-volume",
        name: "Cone Volume",
        category: "geometry",
        tags: ["volume", "cone", "slump", "hopper"],
        summary: "Volume and curved surface of a right circular cone.",
        formula: "Volume = (1/3) × π × r² × h",
        inputs: [
            {
                key: "dia",
                label: "Base diameter",
                quantity: "length",
                defaultUnit: "m",
                default: 1,
                min: 0,
            },
            {
                key: "h",
                label: "Height",
                quantity: "length",
                defaultUnit: "m",
                default: 1.5,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "volume",
                label: "Volume",
                unit: "m³",
                decimals: 4,
                hero: true,
            },
            {
                key: "lateral",
                label: "Curved surface",
                unit: "m²",
                decimals: 4,
            },
        ],
        compute: (v) => {
            const r = v.dia / 2;
            const slant = Math.sqrt(r * r + v.h * v.h);
            return {
                volume: (Math.PI * r * r * v.h) / 3,
                lateral: Math.PI * r * slant,
            };
        },
    },

    {
        id: "pyramid-volume",
        name: "Pyramid Volume",
        category: "geometry",
        tags: ["volume", "pyramid", "square base"],
        summary: "Volume of a pyramid with a rectangular base.",
        formula: "Volume = (1/3) × Base area × Height",
        inputs: [
            {
                key: "l",
                label: "Base length",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
            {
                key: "w",
                label: "Base width",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
            {
                key: "h",
                label: "Height",
                quantity: "length",
                defaultUnit: "m",
                default: 3,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "volume",
                label: "Volume",
                unit: "m³",
                decimals: 4,
                hero: true,
            },
        ],
        compute: (v) => ({ volume: (v.l * v.w * v.h) / 3 }),
    },

    {
        id: "tank-capacity",
        name: "Water Tank Capacity",
        category: "geometry",
        tags: ["water", "tank", "capacity", "litre", "sump", "overhead"],
        summary:
            "Storage capacity of a rectangular or cylindrical tank in litres.",
        formula:
            "Rectangle: Volume = L × W × H   |   Cylinder: Volume = π r² h",
        inputs: [
            {
                key: "shape",
                label: "Tank shape",
                kind: "select",
                default: 0,
                options: [
                    { value: 0, label: "Rectangular" },
                    { value: 1, label: "Cylindrical" },
                ],
            },
            {
                key: "l",
                label: "Length (or diameter)",
                quantity: "length",
                defaultUnit: "m",
                default: 2,
                min: 0,
            },
            {
                key: "w",
                label: "Width (ignored if cylindrical)",
                quantity: "length",
                defaultUnit: "m",
                default: 1.5,
                min: 0,
            },
            {
                key: "h",
                label: "Depth of water",
                quantity: "length",
                defaultUnit: "m",
                default: 1.5,
                min: 0,
            },
            {
                key: "freeboard",
                label: "Freeboard",
                quantity: "length",
                defaultUnit: "m",
                default: 0.2,
                min: 0,
            },
        ],
        outputs: [
            {
                key: "litres",
                label: "Capacity",
                unit: "litre",
                decimals: 1,
                hero: true,
            },
            { key: "volume", label: "Volume", unit: "m³", decimals: 4 },
            {
                key: "totalLitres",
                label: "Capacity up to the top (with freeboard)",
                unit: "litre",
                decimals: 1,
            },
        ],
        compute: (v) => {
            const base = v.shape === 0 ? v.l * v.w : Math.PI * (v.l / 2) ** 2;
            return {
                litres: base * v.h * 1000,
                volume: base * v.h,
                totalLitres: base * (v.h + v.freeboard) * 1000,
            };
        },
    },
];
