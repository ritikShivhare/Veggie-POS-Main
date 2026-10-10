/**
 * Unit Conversion & Recipe Bill of Materials (BOM) Calculations
 * Handles conversion between recipe portions (e.g. Grams 'g', Milliliters 'ml')
 * and inventory storage units (e.g. Kilograms 'kg', Liters 'l', Pieces 'pcs').
 */

import { Ingredient } from "../types";

export type UnitCategory = "weight" | "volume" | "count" | "other";

interface UnitDefinition {
  canonical: string;
  category: UnitCategory;
  factorToBase: number; // Factor to convert this unit into the category base unit (base: g for weight, ml for volume, pcs for count)
  label: string;
}

const UNIT_MAP: Record<string, UnitDefinition> = {
  // Weight (Base: g)
  g: { canonical: "g", category: "weight", factorToBase: 1, label: "Grams (g)" },
  gm: { canonical: "g", category: "weight", factorToBase: 1, label: "Grams (g)" },
  gms: { canonical: "g", category: "weight", factorToBase: 1, label: "Grams (g)" },
  gram: { canonical: "g", category: "weight", factorToBase: 1, label: "Grams (g)" },
  grams: { canonical: "g", category: "weight", factorToBase: 1, label: "Grams (g)" },

  kg: { canonical: "kg", category: "weight", factorToBase: 1000, label: "Kilograms (kg)" },
  kgs: { canonical: "kg", category: "weight", factorToBase: 1000, label: "Kilograms (kg)" },
  kilogram: { canonical: "kg", category: "weight", factorToBase: 1000, label: "Kilograms (kg)" },
  kilograms: { canonical: "kg", category: "weight", factorToBase: 1000, label: "Kilograms (kg)" },

  mg: { canonical: "mg", category: "weight", factorToBase: 0.001, label: "Milligrams (mg)" },
  milligram: { canonical: "mg", category: "weight", factorToBase: 0.001, label: "Milligrams (mg)" },
  milligrams: { canonical: "mg", category: "weight", factorToBase: 0.001, label: "Milligrams (mg)" },

  // Volume (Base: ml)
  ml: { canonical: "ml", category: "volume", factorToBase: 1, label: "Milliliters (ml)" },
  milliliter: { canonical: "ml", category: "volume", factorToBase: 1, label: "Milliliters (ml)" },
  milliliters: { canonical: "ml", category: "volume", factorToBase: 1, label: "Milliliters (ml)" },

  l: { canonical: "l", category: "volume", factorToBase: 1000, label: "Liters (L)" },
  lt: { canonical: "l", category: "volume", factorToBase: 1000, label: "Liters (L)" },
  ltr: { canonical: "l", category: "volume", factorToBase: 1000, label: "Liters (L)" },
  liter: { canonical: "l", category: "volume", factorToBase: 1000, label: "Liters (L)" },
  liters: { canonical: "l", category: "volume", factorToBase: 1000, label: "Liters (L)" },
  litre: { canonical: "l", category: "volume", factorToBase: 1000, label: "Litres (L)" },
  litres: { canonical: "l", category: "volume", factorToBase: 1000, label: "Litres (L)" },

  // Count (Base: pcs)
  pcs: { canonical: "pcs", category: "count", factorToBase: 1, label: "Pieces (pcs)" },
  pc: { canonical: "pcs", category: "count", factorToBase: 1, label: "Pieces (pcs)" },
  piece: { canonical: "pcs", category: "count", factorToBase: 1, label: "Pieces (pcs)" },
  pieces: { canonical: "pcs", category: "count", factorToBase: 1, label: "Pieces (pcs)" },
  units: { canonical: "pcs", category: "count", factorToBase: 1, label: "Units" },
  unit: { canonical: "pcs", category: "count", factorToBase: 1, label: "Units" },
  nos: { canonical: "pcs", category: "count", factorToBase: 1, label: "Nos" },
  pack: { canonical: "pack", category: "count", factorToBase: 1, label: "Pack" },
  packs: { canonical: "pack", category: "count", factorToBase: 1, label: "Pack" },
  box: { canonical: "box", category: "count", factorToBase: 1, label: "Box" },
  boxes: { canonical: "box", category: "count", factorToBase: 1, label: "Box" }
};

/**
 * Normalizes a unit string to lower-case trimmed key
 */
export function normalizeUnit(rawUnit?: string): string {
  if (!rawUnit) return "";
  return rawUnit.trim().toLowerCase();
}

/**
 * Resolves the unit definition or returns a generic fallback
 */
export function getUnitDefinition(unit?: string): UnitDefinition {
  const norm = normalizeUnit(unit);
  if (norm && UNIT_MAP[norm]) {
    return UNIT_MAP[norm];
  }
  return {
    canonical: norm || "unit",
    category: "other",
    factorToBase: 1,
    label: unit || "Unit"
  };
}

/**
 * Calculates conversion multiplier from `fromUnit` to `toUnit`.
 * Returns number `r` such that `quantityInToUnit = quantityInFromUnit * r`.
 * If units are not convertible (e.g. kg to pcs), returns 1 as safe fallback.
 */
export function getUnitConversionRatio(fromUnit?: string, toUnit?: string): number {
  const normFrom = normalizeUnit(fromUnit);
  const normTo = normalizeUnit(toUnit);

  if (!normFrom || !normTo || normFrom === normTo) {
    return 1;
  }

  const defFrom = getUnitDefinition(normFrom);
  const defTo = getUnitDefinition(normTo);

  // If in the same physical category (e.g. weight: g -> kg, or volume: ml -> l)
  if (defFrom.category === defTo.category && defFrom.category !== "other") {
    // E.g. from g (factor 1) to kg (factor 1000) => 1 / 1000 = 0.001
    // E.g. from kg (factor 1000) to g (factor 1) => 1000 / 1 = 1000
    return defFrom.factorToBase / defTo.factorToBase;
  }

  // Same canonical unit (e.g. pack -> pack)
  if (defFrom.canonical === defTo.canonical) {
    return 1;
  }

  // Incompatible categories
  return 1;
}

/**
 * Converts a recipe requirement quantity into the ingredient's inventory storage unit.
 * Example:
 *   recipeQty = 200, recipeUnit = "g", ingredientUnit = "kg"
 *   returns 0.2 (0.2 kg deducted from inventory)
 */
export function convertRecipeQuantityToIngredientStock(
  recipeQty: number,
  recipeUnit: string | undefined,
  ingredientUnit: string
): number {
  if (recipeQty <= 0) return 0;

  // If recipeUnit is not provided, legacy assumes same unit as ingredient
  if (!recipeUnit || normalizeUnit(recipeUnit) === normalizeUnit(ingredientUnit)) {
    return recipeQty;
  }

  const ratio = getUnitConversionRatio(recipeUnit, ingredientUnit);
  return Number((recipeQty * ratio).toFixed(4));
}

/**
 * Suggested recipe units based on the raw material's unit.
 * For example:
 * - If ingredient is "kg", chef will naturally want to enter "g" (recommended) or "kg"
 * - If ingredient is "l", chef will naturally want "ml" (recommended) or "l"
 */
export function getCompatibleUnits(ingredientUnit: string): { value: string; label: string }[] {
  const def = getUnitDefinition(ingredientUnit);

  if (def.category === "weight") {
    return [
      { value: "g", label: "Grams (g)" },
      { value: "kg", label: "Kilograms (kg)" },
      { value: "mg", label: "Milligrams (mg)" }
    ];
  }

  if (def.category === "volume") {
    return [
      { value: "ml", label: "Milliliters (ml)" },
      { value: "l", label: "Liters (L)" }
    ];
  }

  if (def.category === "count") {
    return [
      { value: "pcs", label: "Pieces (pcs)" }
    ];
  }

  return [
    { value: ingredientUnit || "unit", label: ingredientUnit || "Unit" }
  ];
}

/**
 * Returns the recommended default unit for entering recipes for this ingredient.
 * E.g., if ingredient is bought in kg, recipe portions are typically in grams (g).
 * E.g., if ingredient is bought in l, recipe portions are typically in milliliters (ml).
 */
export function getDefaultRecipeUnit(ingredientUnit: string): string {
  const def = getUnitDefinition(ingredientUnit);
  if (def.category === "weight") {
    return "g";
  }
  if (def.category === "volume") {
    return "ml";
  }
  if (def.category === "count") {
    return "pcs";
  }
  return ingredientUnit || "g";
}

/**
 * Calculates the exact raw material cost for a single portion given the recipe quantity and unit,
 * and the ingredient's costPerUnit (WAC).
 */
export function calculatePortionCost(
  recipeQty: number,
  recipeUnit: string | undefined,
  ingredient: Pick<Ingredient, "unit" | "costPerUnit">
): number {
  if (!ingredient || recipeQty <= 0) return 0;
  const stockQty = convertRecipeQuantityToIngredientStock(recipeQty, recipeUnit, ingredient.unit);
  return Number((stockQty * (ingredient.costPerUnit || 0)).toFixed(2));
}

/**
 * Formats a quantity with its unit cleanly (e.g. "200 g" or "0.2 kg")
 */
export function formatQuantityWithUnit(qty: number, unit?: string): string {
  const formattedQty = Number(qty.toFixed(3));
  return `${formattedQty} ${unit || ""}`.trim();
}
