import cron from "node-cron";
import { env } from "./config/env";
import { getDb } from "./db/schema";
import { connectToWhatsApp, waitUntilConnected } from "./whatsapp/connection";
import { onApproved, onRejected, startApprovalListener } from "./whatsapp/approval";
import { postApprovedOfferToGroup } from "./whatsapp/postToGroup";
import { runCollectionCycle } from "./pipeline";
import { logger } from "./utils/logger";

async function main() {
  // Etapa 1: garante que o banco de dados existe e as tabelas foram criadas.
  getDb();

  // Etapa 2: conecta ao WhatsApp (mostra QR Code no terminal no primeiro uso).
  await connectToWhatsApp();

  logger.info("Aguardando autenticacao no WhatsApp (escaneie o QR Code se solicitado)...");
  await waitUntilConnected();

  // Etapa 5: escuta as respostas 1/2 do numero de aprovacao.
  startApprovalListener();

  // Etapa 7: ao aprovar, gera o link de afiliado e posta no grupo.
  onApproved(postApprovedOfferToGroup);
  onRejected((offer) => {
    logger.info({ offerId: offer.id }, "Oferta rejeitada, nada mais a fazer");
  });

  // Etapas 3+4: roda a coleta uma vez ao iniciar e depois no intervalo configurado.
  await runCollectionCycle().catch((err) =>
    logger.error({ err }, "Erro no ciclo de coleta inicial")
  );

  const cronExpression = `*/${env.collectorIntervalMinutes} * * * *`;
  cron.schedule(cronExpression, () => {
    runCollectionCycle().catch((err) =>
      logger.error({ err }, "Erro no ciclo de coleta agendado")
    );
  });
  logger.info(
    { intervalMinutes: env.collectorIntervalMinutes },
    "Coletor agendado"
  );
}

main().catch((err) => {
  logger.error({ err }, "Erro fatal ao iniciar o bot");
  process.exit(1);
});
