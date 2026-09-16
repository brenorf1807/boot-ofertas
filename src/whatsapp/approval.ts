import { requireApprovalNumber } from "../config/env";
import { getOfferById, setOfferStatus } from "../db/queries";
import type { Offer } from "../types/offer";
import { logger } from "../utils/logger";
import { calcDiscountPercent, formatPrice } from "../utils/price";
import { numberToJid, onMessage, sendText } from "./connection";

type ApprovalDecisionHandler = (offer: Offer) => void | Promise<void>;

const queue: number[] = [];
let currentOfferId: number | null = null;
let onApprovedHandler: ApprovalDecisionHandler | null = null;
let onRejectedHandler: ApprovalDecisionHandler | null = null;

export function formatApprovalMessage(offer: Offer): string {
  const discount = calcDiscountPercent(offer.price_original, offer.price_current);

  const lines = [
    `🔥 ${offer.product_name}`,
    offer.price_original !== null
      ? `De: R$ ${formatPrice(offer.price_original)}`
      : null,
    `Por: R$ ${formatPrice(offer.price_current)}${discount !== null ? ` (-${discount}%)` : ""}`,
    `Fonte: ${offer.source}`,
    offer.original_link,
    "",
    "Responda: 1 = aprovar | 2 = rejeitar",
  ];

  return lines.filter((l) => l !== null).join("\n");
}

async function sendNextInQueue(): Promise<void> {
  if (currentOfferId !== null) return; // ja existe uma oferta aguardando resposta

  const nextId = queue.shift();
  if (nextId === undefined) return;

  const offer = getOfferById(nextId);
  if (!offer) {
    logger.warn({ offerId: nextId }, "Oferta da fila de aprovacao nao encontrada, pulando");
    return sendNextInQueue();
  }

  currentOfferId = nextId;
  await sendText(numberToJid(requireApprovalNumber()), formatApprovalMessage(offer));
  logger.info({ offerId: nextId }, "Oferta enviada para aprovacao");
}

/** Adiciona uma oferta (ja com status `awaiting_approval`) na fila de aprovacao. */
export function enqueueForApproval(offerId: number): void {
  queue.push(offerId);
  void sendNextInQueue();
}

/** Registra o callback chamado quando uma oferta e' aprovada (Etapa 7 liga a postagem no grupo aqui). */
export function onApproved(handler: ApprovalDecisionHandler): void {
  onApprovedHandler = handler;
}

export function onRejected(handler: ApprovalDecisionHandler): void {
  onRejectedHandler = handler;
}

/** Liga o processamento das respostas 1/2 recebidas do numero de aprovacao. */
export function startApprovalListener(): void {
  const approvalJid = numberToJid(requireApprovalNumber());

  onMessage(async (from, text) => {
    if (from !== approvalJid) return;

    if (currentOfferId === null) {
      logger.debug({ from, text }, "Resposta recebida sem oferta pendente, ignorando");
      return;
    }

    const offerId = currentOfferId;
    const offer = getOfferById(offerId);

    if (text === "1") {
      setOfferStatus(offerId, "approved");
      logger.info({ offerId }, "Oferta aprovada");
      currentOfferId = null;
      if (offer && onApprovedHandler) await onApprovedHandler(offer);
    } else if (text === "2") {
      setOfferStatus(offerId, "rejected");
      logger.info({ offerId }, "Oferta rejeitada");
      currentOfferId = null;
      if (offer && onRejectedHandler) await onRejectedHandler(offer);
    } else {
      await sendText(approvalJid, 'Resposta invalida. Responda "1" para aprovar ou "2" para rejeitar.');
      return;
    }

    await sendNextInQueue();
  });
}
