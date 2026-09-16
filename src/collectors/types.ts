export interface CollectedOffer {
  productName: string;
  priceCurrent: number;
  priceOriginal: number | null;
  originalLink: string;
  imageUrl: string | null;
  source: string;
  /** Categoria informada pela fonte, quando disponivel (usada no filtro de blocklist). */
  category?: string | null;
}

export interface Collector {
  /** Nome curto usado como `source` no banco e nos logs (ex: "promobit"). */
  source: string;
  collect(): Promise<CollectedOffer[]>;
}
