import type { Calculator } from "@/core/types";
import { NOMINAL_MIX_OPTIONS, concreteMaterials } from "./shared";

const UNIT_OPTIONS = [
    { value: 0, label: "nos" },
    { value: 1, label: "m³" },
    { value: 2, label: "m²" },
    { value: 3, label: "m" },
    { value: 4, label: "kg" },
    { value: 5, label: "tonne" },
    { value: 6, label: "bag" },
    { value: 7, label: "litre" },
];

export const BOQ_CALCULATORS: Calculator[] = [
    {
        id: "boq-line-total",
        name: "BOQ Line Item Total",
        category: "boq",
        tags: [
            "boq",
            "bill of quantities",
            "estimate",
            "rate",
            "amount",
            "cost",
            "vat",
            "gst",
        ],
        summary:
            "Line-item amount with contingency and tax for a bill of quantities.",
        formula:
            "Subtotal = Quantity × Rate\nContingency = Subtotal × contingency %\nTax = (Subtotal + Contingency) × tax %\nTotal = Subtotal + Contingency + Tax",
        reference:
            "Standard BOQ practice. VAT/GST and contingency rates vary by project and country.",
        inputs: [
            { key: "quantity", label: "Quantity", default: 100, min: 0 },
            {
                key: "unit",
                label: "Unit",
                kind: "select",
                default: 1,
                options: UNIT_OPTIONS,
            },
            { key: "rate", label: "Rate per unit", default: 4500, min: 0 },
            {
                key: "contingency",
                label: "Contingency",
                default: 5,
                min: 0,
                max: 30,
                help: "% of the subtotal",
            },
            {
                key: "tax",
                label: "Tax / VAT / GST",
                default: 13,
                min: 0,
                max: 30,
                help: "% applied after contingency",
            },
        ],
        outputs: [
            { key: "total", label: "Line total", decimals: 2, hero: true },
            { key: "subtotal", label: "Subtotal (qty × rate)", decimals: 2 },
            { key: "contingencyAmount", label: "Contingency", decimals: 2 },
            { key: "taxAmount", label: "Tax", decimals: 2 },
            { key: "beforeTax", label: "Amount before tax", decimals: 2 },
        ],
        notes: [
            "Round the quantity up to a practical ordering figure before pricing materials.",
            "Keep contingency and tax separate so the tender can be checked line by line.",
        ],
        compute: (v) => {
            const subtotal = v.quantity * v.rate;
            const contingencyAmount = (subtotal * v.contingency) / 100;
            const beforeTax = subtotal + contingencyAmount;
            const taxAmount = (beforeTax * v.tax) / 100;
            return {
                total: beforeTax + taxAmount,
                subtotal,
                contingencyAmount,
                taxAmount,
                beforeTax,
            };
        },
    },

    {
        id: "concrete-rate-analysis",
        name: "Concrete Rate Analysis",
        category: "boq",
        tags: [
            "rate analysis",
            "concrete",
            "cost",
            "boq",
            "estimate",
            "per m3",
            "cement rate",
        ],
        summary:
            "Cost per cubic metre of concrete from material and labour rates.",
        formula:
            "Material cost = Σ (quantity × rate)\nRate per m³ = (Material cost + Labour + Plant) ÷ Volume",
        reference:
            "Standard rate-analysis format. Adjust rates to the local market and include overheads and profit.",
        inputs: [
            {
                key: "volume",
                label: "Concrete volume",
                quantity: "volume",
                defaultUnit: "m3",
                default: 10,
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
                key: "cementRate",
                label: "Cement rate",
                default: 550,
                min: 0,
                help: "per 50 kg bag",
            },
            {
                key: "sandRate",
                label: "Sand rate",
                default: 2200,
                min: 0,
                help: "per m³",
            },
            {
                key: "aggRate",
                label: "Coarse aggregate rate",
                default: 2600,
                min: 0,
                help: "per m³",
            },
            {
                key: "labourRate",
                label: "Labour cost",
                default: 1200,
                min: 0,
                help: "per m³ of concrete",
            },
            {
                key: "plantRate",
                label: "Plant and machinery",
                default: 400,
                min: 0,
                help: "per m³ of concrete",
            },
            {
                key: "overhead",
                label: "Overhead and profit",
                default: 15,
                min: 0,
                max: 40,
                help: "% of the direct cost",
            },
        ],
        outputs: [
            { key: "ratePerM3", label: "Rate per m³", decimals: 2, hero: true },
            { key: "totalCost", label: "Total cost", decimals: 2 },
            { key: "cementCost", label: "Cement cost", decimals: 2 },
            { key: "sandCost", label: "Sand cost", decimals: 2 },
            { key: "aggCost", label: "Aggregate cost", decimals: 2 },
            { key: "labourCost", label: "Labour cost", decimals: 2 },
            { key: "plantCost", label: "Plant cost", decimals: 2 },
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
                label: "Aggregate volume",
                quantity: "volume",
                unit: "m3",
                decimals: 3,
            },
        ],
        notes: [
            "Rates exclude any tax. Add VAT/GST at the BOQ level rather than inside the rate.",
            "Water, curing, formwork and reinforcement are not included — add them as separate BOQ items.",
        ],
        compute: (v) => {
            const m = concreteMaterials(v.volume, v.grade, { wastage: 3 });

            const cementCost = m.cementBags * v.cementRate;
            const sandCost = m.sandM3 * v.sandRate;
            const aggCost = m.aggM3 * v.aggRate;
            const labourCost = v.volume * v.labourRate;
            const plantCost = v.volume * v.plantRate;

            const direct =
                cementCost + sandCost + aggCost + labourCost + plantCost;
            const totalCost = direct * (1 + v.overhead / 100);

            return {
                ratePerM3: v.volume > 0 ? totalCost / v.volume : 0,
                totalCost,
                cementCost,
                sandCost,
                aggCost,
                labourCost,
                plantCost,
                cementBags: m.cementBags,
                sandM3: m.sandM3,
                aggM3: m.aggM3,
            };
        },
    },

    {
        id: "material-cost",
        name: "Material Cost Calculator",
        category: "boq",
        tags: ["material", "cost", "quantity", "rate", "estimate", "simple"],
        summary:
            "Straightforward cost of a quantity of material at a given rate.",
        formula: "Cost = Quantity × Rate",
        inputs: [
            { key: "quantity", label: "Quantity", default: 50, min: 0 },
            {
                key: "unit",
                label: "Unit",
                kind: "select",
                default: 1,
                options: UNIT_OPTIONS,
            },
            { key: "rate", label: "Rate per unit", default: 550, min: 0 },
            {
                key: "wastage",
                label: "Wastage",
                default: 0,
                min: 0,
                max: 30,
                help: "% added to the quantity",
            },
            {
                key: "discount",
                label: "Trade discount",
                default: 0,
                min: 0,
                max: 50,
                help: "% deducted from the gross cost",
            },
        ],
        outputs: [
            { key: "netCost", label: "Net cost", decimals: 2, hero: true },
            {
                key: "orderQuantity",
                label: "Quantity to order (with wastage)",
                decimals: 3,
            },
            { key: "grossCost", label: "Gross cost", decimals: 2 },
            { key: "discountAmount", label: "Discount", decimals: 2 },
        ],
        compute: (v) => {
            const orderQuantity = v.quantity * (1 + v.wastage / 100);
            const grossCost = orderQuantity * v.rate;
            const discountAmount = (grossCost * v.discount) / 100;
            return {
                netCost: grossCost - discountAmount,
                orderQuantity,
                grossCost,
                discountAmount,
            };
        },
    },

    {
        id: "labour-days-cost",
        name: "Labour Days & Cost",
        category: "boq",
        tags: [
            "labour",
            "productivity",
            "man days",
            "cost",
            "schedule",
            "duration",
        ],
        summary:
            "Man-days, calendar duration and labour cost from a productivity rate.",
        formula:
            "Man-days = Quantity ÷ Productivity\nDuration = Man-days ÷ Number of workers\nCost = Man-days × Daily wage",
        inputs: [
            {
                key: "quantity",
                label: "Quantity of work",
                default: 100,
                min: 0,
            },
            {
                key: "unit",
                label: "Unit",
                kind: "select",
                default: 2,
                options: UNIT_OPTIONS,
            },
            {
                key: "productivity",
                label: "Productivity per person-day",
                default: 8,
                min: 0,
                help: "Units completed by one worker in one day",
            },
            {
                key: "workers",
                label: "Number of workers",
                default: 4,
                min: 1,
                step: 1,
            },
            {
                key: "wage",
                label: "Daily wage per worker",
                default: 1200,
                min: 0,
            },
            {
                key: "hoursPerDay",
                label: "Working hours per day",
                default: 8,
                min: 1,
                max: 24,
                step: 0.5,
            },
        ],
        outputs: [
            {
                key: "manDays",
                label: "Man-days required",
                decimals: 2,
                hero: true,
            },
            { key: "duration", label: "Duration in working days", decimals: 2 },
            { key: "labourCost", label: "Labour cost", decimals: 2 },
            { key: "manHours", label: "Man-hours", decimals: 1 },
            {
                key: "productionPerDay",
                label: "Output per day with this crew",
                decimals: 2,
            },
        ],
        notes: [
            "Add an allowance for weather, idle time and rework — typically 10–20% on the duration.",
            "Productivity figures vary widely; use your own site records once you have them.",
        ],
        compute: (v) => {
            const manDays =
                v.productivity > 0 ? v.quantity / v.productivity : 0;
            const duration = manDays / Math.max(v.workers, 1);
            return {
                manDays,
                duration,
                labourCost: manDays * v.wage,
                manHours: manDays * v.hoursPerDay,
                productionPerDay: v.productivity * v.workers,
            };
        },
    },

    {
        id: "boq-project-total",
        name: "BOQ Project Total",
        category: "boq",
        tags: [
            "boq",
            "project total",
            "summary",
            "tender",
            "overhead",
            "profit",
            "vat",
            "gst",
            "estimate",
        ],
        summary:
            "Roll up to eight BOQ line amounts into a project total with contingency, overhead and tax.",
        inputs: [
            {
                key: "amount1",
                label: "Line 1 — amount",
                unit: "amount",
                default: 250000,
                min: 0,
            },
            {
                key: "amount2",
                label: "Line 2 — amount",
                unit: "amount",
                default: 180000,
                min: 0,
            },
            {
                key: "amount3",
                label: "Line 3 — amount",
                unit: "amount",
                default: 95000,
                min: 0,
            },
            {
                key: "amount4",
                label: "Line 4 — amount",
                unit: "amount",
                default: 60000,
                min: 0,
            },
            {
                key: "amount5",
                label: "Line 5 — amount",
                unit: "amount",
                default: 0,
                min: 0,
            },
            {
                key: "amount6",
                label: "Line 6 — amount",
                unit: "amount",
                default: 0,
                min: 0,
            },
            {
                key: "amount7",
                label: "Line 7 — amount",
                unit: "amount",
                default: 0,
                min: 0,
            },
            {
                key: "amount8",
                label: "Line 8 — amount",
                unit: "amount",
                default: 0,
                min: 0,
            },
            {
                key: "contingency",
                label: "Contingency",
                unit: "%",
                default: 5,
                min: 0,
                max: 30,
                help: "Applied to the subtotal",
            },
            {
                key: "overhead",
                label: "Overhead and profit",
                unit: "%",
                default: 15,
                min: 0,
                max: 40,
                help: "Applied to the subtotal",
            },
            {
                key: "tax",
                label: "Tax / VAT / GST",
                unit: "%",
                default: 13,
                min: 0,
                max: 30,
                help: "Applied after contingency and overhead",
            },
            {
                key: "roundTo",
                label: "Round the grand total up to the nearest",
                default: 1000,
                min: 1,
            },
        ],
        outputs: [
            {
                key: "grandTotal",
                label: "Grand total",
                decimals: 2,
                hero: true,
            },
            {
                key: "roundedTotal",
                label: "Rounded up for the tender",
                decimals: 0,
            },
            {
                key: "subtotal",
                label: "Subtotal of the line items",
                decimals: 2,
            },
            { key: "contingencyAmount", label: "Contingency", decimals: 2 },
            {
                key: "overheadAmount",
                label: "Overhead and profit",
                decimals: 2,
            },
            { key: "beforeTax", label: "Amount before tax", decimals: 2 },
            { key: "taxAmount", label: "Tax", decimals: 2 },
            {
                key: "linesUsed",
                label: "Line items entered",
                unit: "nos",
                decimals: 0,
            },
            {
                key: "largestShare",
                label: "Share of the largest line item",
                unit: "%",
                decimals: 1,
            },
        ],
        notes: [
            "Leave unused lines at zero. Only non-zero lines are counted.",
            "Contingency covers unforeseen work. It is not the same as overhead and profit, which is the contractor's margin.",
            "Tax applies to the whole sum, so keep it out of the individual rates.",
            "Use the line-item calculator to build each amount, then roll them up here.",
            "Check the largest line — if one item dominates the estimate, revisit its assumptions first.",
        ],
        compute: (v) => {
            const lines = [
                v.amount1,
                v.amount2,
                v.amount3,
                v.amount4,
                v.amount5,
                v.amount6,
                v.amount7,
                v.amount8,
            ].filter((a) => a > 0);

            const subtotal = lines.reduce((a, b) => a + b, 0);
            const contingencyAmount = (subtotal * v.contingency) / 100;
            const overheadAmount = (subtotal * v.overhead) / 100;
            const beforeTax = subtotal + contingencyAmount + overheadAmount;
            const taxAmount = (beforeTax * v.tax) / 100;
            const grandTotal = beforeTax + taxAmount;
            const step = Math.max(v.roundTo, 1);

            return {
                grandTotal,
                roundedTotal: Math.ceil(grandTotal / step) * step,
                subtotal,
                contingencyAmount,
                overheadAmount,
                beforeTax,
                taxAmount,
                linesUsed: lines.length,
                largestShare:
                    subtotal > 0 ? (Math.max(...lines, 0) / subtotal) * 100 : 0,
            };
        },
    },

    {
        id: "excavation-backfill",
        name: "Excavation, Backfill & Disposal",
        category: "boq",
        tags: [
            "excavation",
            "backfill",
            "earthwork",
            "disposal",
            "bulking",
            "compaction",
            "trench",
            "quantity",
        ],
        summary:
            "Excavation volume, backfill requirement and the surplus spoil to cart away.",
        formula:
            "Excavation = L × W × D\nBackfill = Excavation − volume of the buried structure\nLoose spoil = Excavation × (1 + bulking)\nLoose backfill needed = Backfill × (1 + compaction)",
        reference:
            "Standard earthwork takeoff. Bulking of 20–30% is typical for excavated soil; compaction allowance 8–15%.",
        inputs: [
            {
                key: "length",
                label: "Excavation length",
                quantity: "length",
                defaultUnit: "m",
                default: 20,
                min: 0,
            },
            {
                key: "width",
                label: "Excavation width",
                quantity: "length",
                defaultUnit: "m",
                default: 1.2,
                min: 0,
            },
            {
                key: "depth",
                label: "Excavation depth",
                quantity: "length",
                defaultUnit: "m",
                default: 1.5,
                min: 0,
            },
            {
                key: "structure",
                label: "Volume of the buried structure",
                unit: "m³",
                default: 6,
                min: 0,
                help: "Foundation concrete, pipes, ducts — anything left in the ground",
            },
            {
                key: "bulking",
                label: "Bulking of the excavated soil",
                unit: "%",
                default: 25,
                min: 0,
                max: 60,
                help: "Spoil occupies more volume once loosened",
            },
            {
                key: "compaction",
                label: "Extra allowance for compacted backfill",
                unit: "%",
                default: 10,
                min: 0,
                max: 40,
            },
            {
                key: "truckVolume",
                label: "Capacity of one haulage trip",
                unit: "m³",
                default: 8,
                min: 0.5,
                step: 0.5,
            },
        ],
        outputs: [
            {
                key: "excavation",
                label: "Excavation volume (in situ)",
                unit: "m³",
                decimals: 2,
                hero: true,
            },
            {
                key: "backfill",
                label: "Backfill required (compacted)",
                unit: "m³",
                decimals: 2,
            },
            {
                key: "backfillLoose",
                label: "Loose soil needed for the backfill",
                unit: "m³",
                decimals: 2,
            },
            {
                key: "spoilLoose",
                label: "Total loose spoil produced",
                unit: "m³",
                decimals: 2,
            },
            {
                key: "surplus",
                label: "Surplus to cart away (loose)",
                unit: "m³",
                decimals: 2,
            },
            {
                key: "shortfall",
                label: "Shortfall to import (loose)",
                unit: "m³",
                decimals: 2,
            },
            { key: "trips", label: "Haulage trips", unit: "nos", decimals: 0 },
            { key: "balance", label: "Material balance" },
        ],
        notes: [
            "Excavation is measured in situ (bank volume). Spoil is measured loose, which is why bulking matters.",
            "Backfill is measured as compacted volume in the finished work.",
            "If the shortfall is large it may be cheaper to widen the excavation than to import fill.",
            "Add an allowance for over-excavation — trenches are rarely cut to the exact theoretical profile.",
            "Deduct pipes, ducts and bedding from the backfill, as done here with the structure volume.",
        ],
        compute: (v) => {
            const excavation = v.length * v.width * v.depth;
            const backfill = Math.max(excavation - v.structure, 0);

            const spoilLoose = excavation * (1 + v.bulking / 100);
            const backfillLoose = backfill * (1 + v.compaction / 100);
            const difference = spoilLoose - backfillLoose;

            const surplus = Math.max(difference, 0);
            const shortfall = Math.max(-difference, 0);
            const trips =
                v.truckVolume > 0 ? Math.ceil(surplus / v.truckVolume) : 0;

            return {
                excavation,
                backfill,
                backfillLoose,
                spoilLoose,
                surplus,
                shortfall,
                trips,
                balance:
                    difference > 0.01
                        ? `Surplus of ${surplus.toFixed(2)} m³ — cart away ${trips} trips`
                        : difference < -0.01
                          ? `Shortfall of ${shortfall.toFixed(2)} m³ — import fill`
                          : "Balanced — all the spoil can be reused as backfill",
            };
        },
    },
];
