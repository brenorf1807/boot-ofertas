import { env } from "../config/env";
import type { AffiliateAdapter } from "./types";

const AMAZON_HOST_PATTERN = /(^|\.)amazon\.com\.br$/i;

export const amazonAdapter: AffiliateAdapter = {
  name: "amazon",

  matches(url: string): boolean {
    try {
      return AMAZON_HOST_PATTERN.test(new URL(url).hostname);
    } catch {
      return false;
    }
  },

  generate(url: string): string {
    if (!env.amazonAffiliateTag) {
      throw new Error(
        "AMAZON_AFFILIATE_TAG nao configurado no .env; nao e' possivel gerar link de afiliado da Amazon"
      );
    }

    const parsed = new URL(url);
    parsed.searchParams.set("tag", env.amazonAffiliateTag);
    return parsed.toString();
  },
};
