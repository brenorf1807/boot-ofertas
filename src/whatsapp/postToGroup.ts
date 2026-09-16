import { toAffiliateLink } from "../affiliate";
import { requireGroupId } from "../config/env";
import { setOfferPosted } from "../db/queries";
import type { Offer } from "../types/offer";
import { logger } from "../utils/logger";
import { calcDiscountPercent, formatPrice } from "../utils/price";
import { sendImage, sendText } from "./connection";

export function formatGroupMessage(offer: Offer, affiliateLink: string): string {
  const discount = calcDiscountPercent(offer.price_original, offer.price_current);

  const lines = [
    `🔥 ${offer.product_name}`,
    offer.price_original !== null ? `~De: R$ ${formatPrice(offer.price_original)}~` : null,
    `Por: R$ ${formatPrice(offer.price_current)}${discount !== null ? ` (-${discount}%)` : ""}`,
    "",
    `👉 ${affiliateLink}`,
  ];

  return lines.filter((l) => l !== null).join("\n");
}

/**
 * Gera o link de afiliado, monta a mensagem final e posta no grupo
 * configurado (GROUP_ID). Registra no banco que a oferta foi postada.
 * Chamado pelo listener de aprovacao (src/whatsapp/approval.ts) assim que
 * a oferta e' aprovada.
 */
export async function postApprovedOfferToGroup(offer: Offer): Promise<void> {
  const affiliateLink = toAffiliateLink(offer.original_link);
  const message = formatGroupMessage(offer, affiliateLink);
  const groupJid = requireGroupId();

  if (offer.image_url) {
    await sendImage(groupJid, offer.image_url, message);
  } else {
    await sendText(groupJid, message);
  }

  setOfferPosted(offer.id, affiliateLink);
  logger.info({ offerId: offer.id, affiliateLink }, "Oferta postada no grupo");
}
