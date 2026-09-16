/** Formata um valor em reais no padrao brasileiro (ex: 1899 -> "1.899,00"). */
export function formatPrice(value: number): string {
  return value.toLocaleString("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/** Calcula o desconto percentual (arredondado) entre o preco original e o atual. */
export function calcDiscountPercent(
  priceOriginal: number | null,
  priceCurrent: number
): number | null {
  if (priceOriginal === null) return null;
  return Math.round(((priceOriginal - priceCurrent) / priceOriginal) * 100);
}
