import { env } from "./config/env";
import { getDb } from "./db/schema";
import { connectToWhatsApp, numberToJid, onMessage, sendText } from "./whatsapp/connection";
import { logger } from "./utils/logger";

async function main() {
  // Etapa 1: garante que o banco de dados existe e as tabelas foram criadas.
  getDb();

  // Etapa 2: conecta ao WhatsApp (mostra QR Code no terminal no primeiro uso).
  await connectToWhatsApp();

  // Eco de teste: responde qualquer mensagem recebida repetindo o texto.
  // Serve para validar que o envio/recebimento via Baileys esta funcionando
  // de ponta a ponta antes de implementarmos o fluxo real de aprovacao.
  onMessage(async (from, text) => {
    logger.info({ from, text }, "Mensagem de teste recebida, respondendo eco");
    await sendText(from, `Eco: ${text}`);
  });

  // Se um numero de aprovacao ja estiver configurado, envia uma mensagem de
  // teste assim que o bot conectar, para confirmar que o envio funciona.
  if (env.approvalNumber) {
    logger.info("Enviando mensagem de teste para o numero de aprovacao configurado");
    await sendText(
      numberToJid(env.approvalNumber),
      "Bot de ofertas conectado e pronto (teste da Etapa 2)."
    );
  }
}

main().catch((err) => {
  logger.error({ err }, "Erro fatal ao iniciar o bot");
  process.exit(1);
});
