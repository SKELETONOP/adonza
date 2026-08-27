import { DiscountClass, ProductDiscountSelectionStrategy } from '../generated/api';

/**
 * Makes each cart line the storefront script auto-added as a free gift
 * (tagged with the `_bogo_rule_id` line item property when it called
 * /cart/add.js) 100% off. This only ever affects that specific cart line,
 * for that specific cart - it never touches the product's actual catalog
 * price, unlike setting the variant's price to $0.00 in the admin would.
 *
 * @typedef {import("../generated/api").CartInput} RunInput
 * @typedef {import("../generated/api").CartLinesDiscountsGenerateRunResult} CartLinesDiscountsGenerateRunResult
 */

/**
 * @param {RunInput} input
 * @returns {CartLinesDiscountsGenerateRunResult}
 */
export function cartLinesDiscountsGenerateRun(input) {
  const hasProductDiscountClass = input.discount.discountClasses.includes(
    DiscountClass.Product,
  );

  if (!hasProductDiscountClass) {
    return { operations: [] };
  }

  const freeGiftLines = input.cart.lines.filter(
    (line) => line.bogoRuleAttribute && line.bogoRuleAttribute.value,
  );

  if (!freeGiftLines.length) {
    return { operations: [] };
  }

  return {
    operations: [
      {
        productDiscountsAdd: {
          candidates: freeGiftLines.map((line) => ({
            message: 'Free gift',
            targets: [
              {
                cartLine: {
                  id: line.id,
                },
              },
            ],
            value: {
              percentage: {
                value: 100,
              },
            },
          })),
          selectionStrategy: ProductDiscountSelectionStrategy.All,
        },
      },
    ],
  };
}
