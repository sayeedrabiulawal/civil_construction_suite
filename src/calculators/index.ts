import type { Calculator } from "@/core/types";
import { BOQ_CALCULATORS } from "./boq";
import { CONCRETE_CALCULATORS } from "./concrete";
import { CONVERT_CALCULATORS } from "./convert";
import { FOUNDATION_CALCULATORS } from "./foundation";
import { GEOMETRY_CALCULATORS } from "./geometry";
import { HYDRAULIC_CALCULATORS } from "./hydraulics";
import { MATERIAL_CALCULATORS } from "./materials";
import { RCC_CALCULATORS } from "./rcc";
import { SOIL_CALCULATORS } from "./soil";
import { STEEL_CALCULATORS } from "./steel";
import { SURVEYING_CALCULATORS } from "./surveying";
import { TRANSPORTATION_CALCULATORS } from "./transportation";

/**
 * The single place that decides which calculators exist.
 * Adding a new calculator means adding an object to one of these modules —
 * no routes, no screens, no components.
 */
export const ALL_CALCULATORS: Calculator[] = [
    ...MATERIAL_CALCULATORS,
    ...CONCRETE_CALCULATORS,
    ...STEEL_CALCULATORS,
    ...RCC_CALCULATORS,
    ...FOUNDATION_CALCULATORS,
    ...SOIL_CALCULATORS,
    ...SURVEYING_CALCULATORS,
    ...HYDRAULIC_CALCULATORS,
    ...TRANSPORTATION_CALCULATORS,
    ...GEOMETRY_CALCULATORS,
    ...CONVERT_CALCULATORS,
    ...BOQ_CALCULATORS,
];
