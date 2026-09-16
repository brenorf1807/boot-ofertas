import { logger } from "../utils/logger";
import { amazonAdapter } from "./amazon";
import type { AffiliateAdapter } from "./types";

// Para adicionar uma nova plataforma (Shopee, Mercado Livre, Awin, ...):
// 1. Crie um novo arquivo em src/affiliate/<plataforma>.ts implementando AffiliateAdapter
// 2. Registre-o neste array
const adapters: AffiliateAdapter[] = [amazonAdapter];

/**
 * Converte o link original de uma oferta aprovada em link de afiliado,
 * usando o primeiro adapter cujo `matches()` reconhecer a URL. Se nenhum
 * adapter reconhecer a plataforma, devolve o link original inalterado.
 */
export function toAffiliateLink(originalLink: string): string {
  const adapter = adapters.find((a) => a.matches(originalLink));

  if (!adapter) {
    logger.debug(
      { originalLink },
      "Nenhum adapter de afiliado reconhece esta URL; usando o link original"
    );
    return originalLink;
  }

  try {
    return adapter.generate(originalLink);
  } catch (err) {
    logger.error(
      { err, adapter: adapter.name, originalLink },
      "Falha ao gerar link de afiliado; usando o link original"
    );
    return originalLink;
  }
}
