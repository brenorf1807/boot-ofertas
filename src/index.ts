import cron from "node-cron";
import { env } from "./config/env";
import { getDb } from "./db/schema";
import { connectToWhatsApp, listGroups, waitUntilConnected } from "./whatsapp/connection";
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

  // GROUP_ID ainda nao configurado: lista os grupos que o bot ja participa
  // para facilitar descobrir o ID correto, e para por aqui (nao ha como
  // postar ofertas aprovadas sem ele).
  if (!env.groupId) {
    const groups = await listGroups();
    if (groups.length === 0) {
      logger.error(
        "GROUP_ID nao configurado e o bot ainda nao participa de nenhum grupo. Adicione o numero do bot a um grupo do WhatsApp e rode novamente para ver a lista de IDs."
      );
    } else {
      logger.info("GROUP_ID nao configurado. Grupos que o bot ja participa:");
      for (const g of groups) {
        logger.info(`  ${g.id}  ->  ${g.name}`);
      }
      logger.info("Copie o ID do grupo desejado para GROUP_ID no .env e rode novamente.");
    }
    process.exit(0);
  }

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

  if (env.collectorIntervalMinutes > 59) {
    logger.warn(
      { intervalMinutes: env.collectorIntervalMinutes },
      "COLLECTOR_INTERVAL_MINUTES acima de 59 nao e' suportado pelo formato de cron usado (campo de minutos vai de 0 a 59); use um valor <= 59"
    );
  }

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
