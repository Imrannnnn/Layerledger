/**
 * errorHandler.js
 * ----------------------------------------------------------------------------
 * Central error formatting and human-readable translation utility for BakeWealth.
 * Converts technical backend validation errors, Zod paths, and network issues
 * into clear, actionable user feedback:
 *   What went wrong -> Where it went wrong -> What the user needs to do to fix it.
 * ----------------------------------------------------------------------------
 */

/**
 * Parse raw validation strings or backend issue arrays into structured, human-readable info.
 */
export function parseValidationMessage(rawMessage, errorsArray = []) {
  if (Array.isArray(errorsArray) && errorsArray.length > 0) {
    const first = errorsArray[0];
    const fieldPath = String(first.field || first.path?.join(".") || "");

    // Check ingredients quantity
    const ingQtyMatch = fieldPath.match(/ingredients\.(\d+)\.quantity/i);
    if (ingQtyMatch) {
      const idx = parseInt(ingQtyMatch[1], 10) + 1;
      return {
        field: `ingredients.${ingQtyMatch[1]}.quantity`,
        fieldIndex: parseInt(ingQtyMatch[1], 10),
        entity: "recipe",
        step: 3,
        whatWentWrong: `Ingredient ${idx}: Quantity is required and must be greater than 0.`,
        action: "Make sure every ingredient has a quantity greater than 0.",
        humanMessage: `Please check your recipe ingredients. Ingredient ${idx}: Quantity is required and must be greater than 0.`
      };
    }

    // Check ingredients item selection
    const ingItemMatch = fieldPath.match(/ingredients\.(\d+)\.item/i);
    if (ingItemMatch) {
      const idx = parseInt(ingItemMatch[1], 10) + 1;
      return {
        field: `ingredients.${ingItemMatch[1]}.item`,
        fieldIndex: parseInt(ingItemMatch[1], 10),
        entity: "recipe",
        step: 3,
        whatWentWrong: `Ingredient ${idx}: Please select an ingredient from the list.`,
        action: "Select an ingredient from your inventory or remove the row.",
        humanMessage: `Please check your recipe ingredients. Ingredient ${idx}: An ingredient item must be selected.`
      };
    }
  }

  if (!rawMessage || typeof rawMessage !== "string") return null;

  // Pattern 1: ingredients.<index>.quantity or body.ingredients.<index>.quantity
  const ingQtyMatch = rawMessage.match(/(?:body\.)?ingredients\.(\d+)\.quantity/i);
  if (ingQtyMatch) {
    const idx = parseInt(ingQtyMatch[1], 10) + 1;
    return {
      field: `ingredients.${ingQtyMatch[1]}.quantity`,
      fieldIndex: parseInt(ingQtyMatch[1], 10),
      entity: "recipe",
      step: 3,
      whatWentWrong: `Ingredient ${idx}: Quantity is required and must be greater than 0.`,
      action: "Make sure every ingredient has a quantity greater than 0.",
      humanMessage: `Please check your recipe ingredients. Ingredient ${idx}: Quantity is required and must be greater than 0.`
    };
  }

  // Pattern 2: ingredients.<index>.item or body.ingredients.<index>.item
  const ingItemMatch = rawMessage.match(/(?:body\.)?ingredients\.(\d+)\.item/i);
  if (ingItemMatch) {
    const idx = parseInt(ingItemMatch[1], 10) + 1;
    return {
      field: `ingredients.${ingItemMatch[1]}.item`,
      fieldIndex: parseInt(ingItemMatch[1], 10),
      entity: "recipe",
      step: 3,
      whatWentWrong: `Ingredient ${idx}: Please select an ingredient from your inventory.`,
      action: "Select an ingredient from your inventory or remove the row.",
      humanMessage: `Please check your recipe ingredients. Ingredient ${idx}: An ingredient item must be selected.`
    };
  }

  // Pattern 3: General recipe ingredients
  if (/ingredients/i.test(rawMessage)) {
    return {
      field: "ingredients",
      fieldIndex: null,
      entity: "recipe",
      step: 3,
      whatWentWrong: "A valid positive quantity is required for each recipe ingredient.",
      action: "Make sure every ingredient has a quantity greater than 0.",
      humanMessage: "Please check your recipe ingredients. A valid quantity is required for each ingredient. Make sure every ingredient has a quantity greater than 0."
    };
  }

  // Pattern 4: Recipe name
  if (/recipe/i.test(rawMessage) && /name/i.test(rawMessage)) {
    return {
      field: "name",
      fieldIndex: null,
      entity: "recipe",
      step: 3,
      whatWentWrong: "Recipe name is required.",
      action: "Please enter a name for this recipe before saving.",
      humanMessage: "Recipe name is required and cannot be empty."
    };
  }

  // Pattern 5: Company/Business details
  if (/(?:company\.)?name|business name/i.test(rawMessage)) {
    return {
      field: "name",
      fieldIndex: null,
      entity: "company",
      step: 1,
      whatWentWrong: "Business name is required.",
      action: "Please enter your business or bakery name to proceed.",
      humanMessage: "Business name is required."
    };
  }

  // Pattern 6: Inventory Item Cost / Stock
  if (/cost/i.test(rawMessage)) {
    return {
      field: "cost",
      fieldIndex: null,
      entity: "inventory",
      step: 2,
      whatWentWrong: "Cost per unit is missing or invalid.",
      action: "Enter a valid cost per unit (₦) greater than or equal to 0.",
      humanMessage: "Cost per unit must be a valid number greater than or equal to 0."
    };
  }

  if (/stock/i.test(rawMessage)) {
    return {
      field: "stock",
      fieldIndex: null,
      entity: "inventory",
      step: 2,
      whatWentWrong: "Stock quantity is invalid.",
      action: "Enter a valid quantity (greater than or equal to 0).",
      humanMessage: "Stock quantity must be a valid positive number or 0."
    };
  }

  // Pattern 7: Phone number / Email
  if (/phone/i.test(rawMessage)) {
    return {
      field: "phone",
      fieldIndex: null,
      entity: "contact",
      step: null,
      whatWentWrong: "Phone number format is invalid.",
      action: "Please enter a valid phone number (e.g. 08012345678).",
      humanMessage: "Please check your phone number."
    };
  }

  if (/email/i.test(rawMessage)) {
    return {
      field: "email",
      fieldIndex: null,
      entity: "contact",
      step: null,
      whatWentWrong: "Email address format is invalid.",
      action: "Please enter a valid email address (e.g. baker@example.com).",
      humanMessage: "Please check your email address."
    };
  }

  // Pattern 8: General "Validation error: ..."
  if (rawMessage.startsWith("Validation error:")) {
    const cleaned = rawMessage
      .replace(/^Validation error:\s*/i, "")
      .replace(/body\./g, "")
      .replace(/params\./g, "")
      .replace(/query\./g, "");
    return {
      field: null,
      fieldIndex: null,
      whatWentWrong: "Some required details are invalid or missing.",
      action: `Please check your inputs: ${cleaned}`,
      humanMessage: cleaned
    };
  }

  return null;
}

/**
 * Format any API error or exception into a clear, user-facing error object.
 *
 * @param {Error|Object|string} error
 * @param {Object} context - Optional context: { title, operation, step, defaultAction }
 * @returns {Object} { title, whatWentWrong, action, displayMessage, field, fieldIndex, step, rawMessage }
 */
export function formatApiError(error, context = {}) {
  const rawMessage = typeof error === "string"
    ? error
    : (error?.message || error?.error || error?.details || "");

  const errorsArray = error?.errors || [];

  // Log detailed technical error for developer diagnostics
  console.error(`[BakeWealth Error in ${context.operation || "operation"}]:`, {
    rawMessage,
    errorsArray,
    originalError: error,
    context
  });

  const title = context.title || "Unable to complete request";

  const parsed = parseValidationMessage(rawMessage, errorsArray);

  if (parsed) {
    const displayMessage = parsed.action 
      ? `${parsed.whatWentWrong} ${parsed.action}`
      : parsed.whatWentWrong;

    return {
      title,
      whatWentWrong: parsed.whatWentWrong,
      action: parsed.action,
      displayMessage,
      field: parsed.field,
      fieldIndex: parsed.fieldIndex !== undefined ? parsed.fieldIndex : null,
      step: parsed.step !== undefined ? parsed.step : context.step,
      rawMessage
    };
  }

  // Network connection failures
  if (/Failed to fetch|NetworkError|Network request failed|net::ERR|connection refused/i.test(rawMessage)) {
    return {
      title: context.title || "Network Connection Error",
      whatWentWrong: "Unable to connect to the BakeWealth server.",
      action: "Please check your internet connection and try again.",
      displayMessage: "Unable to connect to the server. Please check your internet connection and try again.",
      field: null,
      fieldIndex: null,
      step: context.step,
      rawMessage
    };
  }

  // Plan limit errors
  if (error?.code === "PLAN_LIMIT_REACHED" || /limit reached/i.test(rawMessage)) {
    return {
      title: "Plan Limit Reached",
      whatWentWrong: rawMessage,
      action: "Upgrade your subscription plan to add more records.",
      displayMessage: rawMessage,
      field: null,
      fieldIndex: null,
      step: context.step,
      rawMessage
    };
  }

  // Server 500 / 502 / 503 errors
  if (/500|502|503|504|Internal Server Error/i.test(rawMessage)) {
    return {
      title: context.title || "Server Temporarily Unavailable",
      whatWentWrong: "The server encountered a temporary issue while saving your records.",
      action: "Your data has been safely saved locally. Please try again in a moment.",
      displayMessage: "The server encountered a temporary issue. Your records are saved locally — please try again in a moment.",
      field: null,
      fieldIndex: null,
      step: context.step,
      rawMessage
    };
  }

  // Sanitized general fallback (no raw UUIDs or technical paths)
  const cleanMessage = rawMessage
    .replace(/^Error:\s*/i, "")
    .replace(/^Validation error:\s*/i, "")
    .replace(/body\./g, "")
    .replace(/\b[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}\b/gi, "")
    .trim() || "An unexpected error occurred. Please check your inputs and try again.";

  return {
    title,
    whatWentWrong: cleanMessage,
    action: context.defaultAction || "Please review your inputs and try again.",
    displayMessage: cleanMessage,
    field: null,
    fieldIndex: null,
    step: context.step,
    rawMessage
  };
}
