import { promobitCollector } from "./collectors/promobit";
import type { Collector } from "./collectors/types";
import { getOfferById, insertOfferIfNew, setOfferStatus } from "./db/queries";
import { applyFilters } from "./filters";
import { enqueueForApproval } from "./whatsapp/approval";
import { logger } from "./utils/logger";

// Coletores ativos. Ver src/collectors/pelando.ts para o motivo de a
// Pelando ainda nao estar aqui.
const collectors: Collector[] = [promobitCollector];

/**
 * Roda um ciclo completo: coleta -> grava novas ofertas -> aplica o filtro
 * automatico -> envia as aprovadas para a fila de aprovacao no WhatsApp.
 * Chamado pelo scheduler (src/index.ts) a cada COLLECTOR_INTERVAL_MINUTES.
 */
export async function runCollectionCycle(): Promise<void> {
  for (const collector of collectors) {
    let collected;
    try {
      collected = await collector.collect();
    } catch (err) {
      logger.error({ err, source: collector.source }, "Falha ao coletar ofertas");
      continue;
    }

    let inserted = 0;
    for (const offer of collected) {
      const id = insertOfferIfNew(offer);
      if (id === null) continue; // duplicata, ja coletada antes
      inserted++;

      const stored = getOfferById(id);
      if (!stored) continue;

      const result = applyFilters(stored);
      if (result.passed) {
        setOfferStatus(id, "awaiting_approval");
        enqueueForApproval(id);
        logger.info({ offerId: id, product: stored.product_name }, "Oferta aprovada pelo filtro, enviada para aprovacao manual");
      } else {
        setOfferStatus(id, "discarded");
        logger.info({ offerId: id, product: stored.product_name, reason: result.reason }, "Oferta descartada pelo filtro");
      }
    }

    logger.info(
      { source: collector.source, collected: collected.length, inserted },
      "Ciclo de coleta concluido para a fonte"
    );
  }
}
