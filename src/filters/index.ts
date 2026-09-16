import fs from "node:fs";
import { env } from "../config/env";
import { logger } from "../utils/logger";
import type { Offer } from "../types/offer";

interface Blocklist {
  keywords: string[];
  categories: string[];
}

interface FilterResult {
  passed: boolean;
  reason?: string;
}

function loadBlocklist(): Blocklist {
  try {
    const raw = fs.readFileSync(env.blocklistPath, "utf-8");
    const parsed = JSON.parse(raw);
    return {
      keywords: Array.isArray(parsed.keywords) ? parsed.keywords : [],
      categories: Array.isArray(parsed.categories) ? parsed.categories : [],
    };
  } catch (err) {
    logger.warn(
      { err, path: env.blocklistPath },
      "Nao foi possivel ler o blocklist.json, seguindo sem bloqueios"
    );
    return { keywords: [], categories: [] };
  }
}

function matchesBlocklist(offer: Offer, blocklist: Blocklist): string | null {
  const name = offer.product_name.toLowerCase();
  const keyword = blocklist.keywords.find((k) => name.includes(k.toLowerCase()));
  if (keyword) return `palavra-chave bloqueada: "${keyword}"`;

  if (offer.category) {
    const category = offer.category.toLowerCase();
    const blocked = blocklist.categories.find(
      (c) => c.toLowerCase() === category
    );
    if (blocked) return `categoria bloqueada: "${blocked}"`;
  }

  return null;
}

/**
 * Aplica as regras de pre-curadoria configuraveis (Etapa 4) a uma oferta ja
 * persistida no banco. Recarrega o blocklist.json a cada chamada para que
 * ele possa ser editado sem reiniciar o bot.
 */
export function applyFilters(offer: Offer): FilterResult {
  const blocklist = loadBlocklist();

  const blockedReason = matchesBlocklist(offer, blocklist);
  if (blockedReason) return { passed: false, reason: blockedReason };

  if (env.minPrice !== null && offer.price_current < env.minPrice) {
    return {
      passed: false,
      reason: `preco (R$ ${offer.price_current}) abaixo do minimo (R$ ${env.minPrice})`,
    };
  }

  if (env.maxPrice !== null && offer.price_current > env.maxPrice) {
    return {
      passed: false,
      reason: `preco (R$ ${offer.price_current}) acima do maximo (R$ ${env.maxPrice})`,
    };
  }

  if (offer.price_original === null) {
    return {
      passed: false,
      reason: "sem preco original para calcular o desconto",
    };
  }

  const discountPercent =
    ((offer.price_original - offer.price_current) / offer.price_original) * 100;

  if (discountPercent < env.minDiscountPercent) {
    return {
      passed: false,
      reason: `desconto de ${discountPercent.toFixed(1)}% abaixo do minimo (${env.minDiscountPercent}%)`,
    };
  }

  return { passed: true };
}
