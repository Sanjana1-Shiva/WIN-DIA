/**
 * Weight Parsing Utility
 * 
 * Converts various weight formats to grams (numeric).
 * Used across frontend and backend for consistent weight handling.
 * 
 * Supported formats:
 * - "480g" → 480
 * - "480 g" → 480
 * - 480 → 480
 * - "0.48kg" → 480
 * - "0.48 kg" → 480
 * 
 * Rejects:
 * - null/undefined
 * - empty string
 * - zero/negative values
 * - malformed strings
 * - unsupported units
 */

export interface ParseWeightResult {
  grams: number;
  valid: boolean;
  error?: string;
}

/**
 * Parses weight string or number into grams.
 * Returns validation result with normalized value.
 * 
 * @param input - Weight as string (e.g., "480g", "0.48kg") or number (grams)
 * @returns ParseWeightResult with grams value and validation status
 */
export function parseWeight(input: unknown): ParseWeightResult {
  // Handle null/undefined
  if (input === null || input === undefined) {
    return { grams: 0, valid: false, error: 'Weight is null or undefined' };
  }

  // Handle numeric input (already in grams)
  if (typeof input === 'number') {
    if (!isFinite(input) || input <= 0) {
      return { grams: 0, valid: false, error: `Invalid numeric weight: ${input}` };
    }
    return { grams: Math.round(input), valid: true };
  }

  // Handle string input
  if (typeof input === 'string') {
    const trimmed = input.trim();
    
    if (trimmed === '') {
      return { grams: 0, valid: false, error: 'Weight string is empty' };
    }

    // Match patterns: "480g", "480 g", "0.48kg", "0.48 kg", or just "480"
    const gramMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*g$/i);
    if (gramMatch) {
      const grams = parseFloat(gramMatch[1]);
      if (grams <= 0) {
        return { grams: 0, valid: false, error: `Weight must be positive: ${trimmed}` };
      }
      return { grams: Math.round(grams), valid: true };
    }

    const kgMatch = trimmed.match(/^(\d+(?:\.\d+)?)\s*kg$/i);
    if (kgMatch) {
      const kg = parseFloat(kgMatch[1]);
      if (kg <= 0) {
        return { grams: 0, valid: false, error: `Weight must be positive: ${trimmed}` };
      }
      const grams = Math.round(kg * 1000);
      return { grams, valid: true };
    }

    // Try parsing as plain number (assume grams)
    const numMatch = trimmed.match(/^(\d+(?:\.\d+)?)$/);
    if (numMatch) {
      const grams = parseFloat(numMatch[1]);
      if (grams <= 0) {
        return { grams: 0, valid: false, error: `Weight must be positive: ${trimmed}` };
      }
      return { grams: Math.round(grams), valid: true };
    }

    return { grams: 0, valid: false, error: `Unsupported weight format: ${trimmed}` };
  }

  return { grams: 0, valid: false, error: `Unsupported weight type: ${typeof input}` };
}

/**
 * Parses weight and throws error if invalid.
 * Use when weight is required and failure should halt execution.
 * 
 * @param input - Weight value to parse
 * @param fieldName - Name of field for error messages
 * @throws Error if weight is invalid
 * @returns Weight in grams
 */
export function parseWeightOrThrow(input: unknown, fieldName: string = 'weight'): number {
  const result = parseWeight(input);
  if (!result.valid) {
    throw new Error(`Invalid ${fieldName}: ${result.error}`);
  }
  return result.grams;
}

/**
 * Parses weight with fallback.
 * IMPORTANT: Only use fallback for display purposes, never for shipping calculations.
 * 
 * @param input - Weight value to parse
 * @param fallbackGrams - Fallback value if parsing fails (default: 480g = 1 bundle)
 * @returns Weight in grams
 */
export function parseWeightWithFallback(input: unknown, fallbackGrams: number = 480): number {
  const result = parseWeight(input);
  return result.valid ? result.grams : fallbackGrams;
}
