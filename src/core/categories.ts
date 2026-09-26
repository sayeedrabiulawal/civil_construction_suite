import type { Category } from "./types";

export const CATEGORIES: Category[] = [
    {
        id: "materials",
        name: "Construction Materials",
        icon: "🧱",
        blurb: "Cement, sand, aggregate, bricks, plaster, paint and tiles.",
    },
    {
        id: "concrete",
        name: "Concrete",
        icon: "🧪",
        blurb: "Mix design, grades, water-cement ratio, admixture dosage.",
    },
    {
        id: "steel",
        name: "Steel & Reinforcement",
        icon: "🔩",
        blurb: "Bar weight, BBS, lap and development length, cutting length.",
    },
    {
        id: "rcc",
        name: "RCC & Structural",
        icon: "🏗️",
        blurb: "Slab, beam, column, footing, staircase quantities and loads.",
    },
    {
        id: "foundation",
        name: "Foundation",
        icon: "⚓",
        blurb: "Footing sizing, bearing capacity checks, earth pressure.",
    },
    {
        id: "soil",
        name: "Soil & Geotechnical",
        icon: "⛰️",
        blurb: "Moisture content, density, void ratio, compaction, gradation.",
    },
    {
        id: "surveying",
        name: "Surveying",
        icon: "📐",
        blurb: "Levelling, area by coordinates, tape and slope corrections.",
    },
    {
        id: "hydraulics",
        name: "Hydraulics & Water",
        icon: "💧",
        blurb: "Flow rate, Manning, Hazen-Williams, runoff, pipe sizing.",
    },
    {
        id: "transportation",
        name: "Transportation",
        icon: "🛣️",
        blurb: "Superelevation, sight distance, curves, pavement thickness.",
    },
    {
        id: "geometry",
        name: "Areas & Volumes",
        icon: "📏",
        blurb: "Geometric shapes, areas, volumes and quantities.",
    },
    {
        id: "convert",
        name: "Unit Converter",
        icon: "🔄",
        blurb: "Length, area, volume, mass, force, pressure, flow and more.",
    },
    {
        id: "boq",
        name: "BOQ & Estimation",
        icon: "💰",
        blurb: "Rate analysis, material costing, quantity takeoff.",
    },
];

export const CATEGORY_BY_ID: Record<string, Category> = Object.fromEntries(
    CATEGORIES.map((c) => [c.id, c]),
);
