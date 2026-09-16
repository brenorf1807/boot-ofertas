import { logger } from "../utils/logger";
import type { CollectedOffer, Collector } from "./types";

/**
 * Coletor da Pelando.
 *
 * Status: BLOQUEADO. O site esta atras de um desafio anti-bot do Cloudflare
 * (managed challenge) mesmo na requisicao de robots.txt, entao um
 * `fetch`/HTTP simples nao consegue ler o HTML da listagem — retorna a
 * pagina de desafio em vez do conteudo. Para viabilizar esse coletor seria
 * necessario um navegador headless com bypass de fingerprinting (ex:
 * Playwright + stealth) ou usar uma API oficial de parceiros da Pelando, se
 * existir uma. Por ora o coletor fica registrado com a interface pronta,
 * mas nao e' incluido no scheduler (ver src/index.ts) ate essa limitacao
 * ser resolvida.
 */
export const pelandoCollector: Collector = {
  source: "pelando",

  async collect(): Promise<CollectedOffer[]> {
    logger.warn(
      "Coletor da Pelando esta desabilitado: o site bloqueia requisicoes HTTP simples com um desafio anti-bot do Cloudflare"
    );
    return [];
  },
};
