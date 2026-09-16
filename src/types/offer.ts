export type OfferStatus =
  | "pending_review"
  | "awaiting_approval"
  | "approved"
  | "rejected"
  | "discarded"
  | "posted";

export interface Offer {
  id: number;
  product_name: string;
  price_current: number;
  price_original: number | null;
  original_link: string;
  image_url: string | null;
  source: string;
  collected_at: string;
  status: OfferStatus;
  affiliate_link: string | null;
  posted_at: string | null;
}
