import { logger } from "../utils/logger";
import type { CollectedOffer, Collector } from "./types";

const PAGE_URL = "https://www.promobit.com.br/";
const IMAGE_HOST = "https://i.promobit.com.br";
const USER_AGENT =
  "Mozilla/5.0 (compatible; boot-ofertas/1.0; +https://github.com/) " +
  "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";

// Formato do JSON embutido em <script id="__NEXT_DATA__">, apenas os campos
// que interessam para o coletor.
interface PromobitOffer {
  offerId: number;
  offerTitle: string;
  offerPrice: number;
  offerOldPrice: number;
  offerSlug: string;
  offerPhoto: string | null;
  categoryName: string | null;
}

function extractNextData(html: string): unknown {
  const match = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">(.*?)<\/script>/s
  );
  if (!match) {
    throw new Error(
      "Bloco __NEXT_DATA__ nao encontrado no HTML da Promobit (o site pode ter mudado de layout)"
    );
  }
  return JSON.parse(match[1]);
}

function toCollectedOffer(offer: PromobitOffer): CollectedOffer | null {
  if (!offer.offerTitle || !offer.offerSlug || !offer.offerPrice) return null;

  // offerOldPrice vem 0 (ou igual ao preco atual) quando a fonte nao informa
  // um "de-por" real; nesses casos nao ha preco original confiavel.
  const priceOriginal =
    offer.offerOldPrice > offer.offerPrice ? offer.offerOldPrice : null;

  return {
    productName: offer.offerTitle.trim(),
    priceCurrent: offer.offerPrice,
    priceOriginal,
    originalLink: `https://www.promobit.com.br/oferta/${offer.offerSlug}/`,
    imageUrl: offer.offerPhoto ? `${IMAGE_HOST}${offer.offerPhoto}` : null,
    source: "promobit",
    category: offer.categoryName,
  };
}

export const promobitCollector: Collector = {
  source: "promobit",

  async collect(): Promise<CollectedOffer[]> {
    const res = await fetch(PAGE_URL, {
      headers: { "User-Agent": USER_AGENT, "Accept-Language": "pt-BR" },
      signal: AbortSignal.timeout(15_000),
    });

    if (!res.ok) {
      throw new Error(`Promobit respondeu HTTP ${res.status}`);
    }

    const html = await res.text();
    const nextData = extractNextData(html) as {
      props?: { pageProps?: { serverOffers?: { offers?: PromobitOffer[] } } };
    };
    const rawOffers = nextData.props?.pageProps?.serverOffers?.offers ?? [];

    const offers = rawOffers
      .map(toCollectedOffer)
      .filter((o): o is CollectedOffer => o !== null);

    logger.debug(
      { count: offers.length },
      "Ofertas extraidas da pagina inicial da Promobit"
    );
    return offers;
  },
};
