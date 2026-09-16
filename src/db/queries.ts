import { getDb } from "./schema";
import type { Offer, OfferStatus } from "../types/offer";
import type { CollectedOffer } from "../collectors/types";

/**
 * Insere a oferta coletada se o link original ainda nao existir no banco.
 * Retorna o `id` da nova linha, ou `null` se ja era uma duplicata (evita
 * reprocessar a mesma oferta a cada execucao do coletor).
 */
export function insertOfferIfNew(offer: CollectedOffer): number | null {
  const db = getDb();
  const result = db
    .prepare(
      `INSERT OR IGNORE INTO offers
        (product_name, price_current, price_original, original_link, image_url, source, category)
       VALUES (@productName, @priceCurrent, @priceOriginal, @originalLink, @imageUrl, @source, @category)`
    )
    .run({ category: null, ...offer });

  return result.changes > 0 ? Number(result.lastInsertRowid) : null;
}

export function getOffersByStatus(status: OfferStatus): Offer[] {
  return getDb()
    .prepare("SELECT * FROM offers WHERE status = ? ORDER BY collected_at ASC")
    .all(status) as Offer[];
}

export function getOfferById(id: number): Offer | undefined {
  return getDb().prepare("SELECT * FROM offers WHERE id = ?").get(id) as
    | Offer
    | undefined;
}

export function setOfferStatus(id: number, status: OfferStatus): void {
  getDb().prepare("UPDATE offers SET status = ? WHERE id = ?").run(status, id);
}

export function setOfferPosted(id: number, affiliateLink: string): void {
  getDb()
    .prepare(
      `UPDATE offers
       SET status = 'posted', affiliate_link = ?, posted_at = datetime('now')
       WHERE id = ?`
    )
    .run(affiliateLink, id);
}
