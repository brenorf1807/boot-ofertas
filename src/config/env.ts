import "dotenv/config";
import path from "node:path";

function required(name: string, value: string | undefined): string {
  if (!value || value.trim() === "") {
    throw new Error(
      `Variavel de ambiente obrigatoria ausente: ${name}. Confira o arquivo .env (veja .env.example).`
    );
  }
  return value;
}

export const env = {
  whatsappSessionDir: path.resolve(
    process.env.WHATSAPP_SESSION_DIR ?? "./auth_session"
  ),
  // Numero que recebe as ofertas para aprovacao. So e' exigido quando o bot
  // ja estiver enviando aprovacoes (Etapa 5); na Etapa 2 pode ficar vazio.
  approvalNumber: process.env.APPROVAL_NUMBER ?? "",
  groupId: process.env.GROUP_ID ?? "",
  collectorIntervalMinutes: Number(
    process.env.COLLECTOR_INTERVAL_MINUTES ?? "20"
  ),
  dbPath: path.resolve(process.env.DB_PATH ?? "./data/ofertas.db"),
  logLevel: process.env.LOG_LEVEL ?? "info",
  amazonAffiliateTag: process.env.AMAZON_AFFILIATE_TAG ?? "",
};

export function requireApprovalNumber(): string {
  return required("APPROVAL_NUMBER", env.approvalNumber);
}

export function requireGroupId(): string {
  return required("GROUP_ID", env.groupId);
}
