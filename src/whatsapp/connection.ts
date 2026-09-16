import makeWASocket, {
  DisconnectReason,
  fetchLatestBaileysVersion,
  useMultiFileAuthState,
  type WASocket,
} from "@whiskeysockets/baileys";
import { Boom } from "@hapi/boom";
import qrcodeTerminal from "qrcode-terminal";
import { env } from "../config/env";
import { logger } from "../utils/logger";

type MessageHandler = (from: string, text: string) => void | Promise<void>;

let sock: WASocket | null = null;
const messageHandlers: MessageHandler[] = [];

let resolveFirstConnection: () => void;
const firstConnection = new Promise<void>((resolve) => {
  resolveFirstConnection = resolve;
});

/**
 * Resolve na primeira vez em que a conexao com o WhatsApp for autenticada
 * com sucesso (evento `connection === "open"`). Use antes de enviar
 * mensagens logo apos `connectToWhatsApp()`, para nao tentar enviar antes
 * do QR Code ser escaneado.
 */
export function waitUntilConnected(): Promise<void> {
  return firstConnection;
}

/**
 * Registra uma funcao que sera chamada para cada mensagem de texto recebida
 * (usado, por exemplo, para processar as respostas 1/2 da fila de aprovacao
 * na Etapa 5).
 */
export function onMessage(handler: MessageHandler): void {
  messageHandlers.push(handler);
}

/**
 * Abre a conexao com o WhatsApp via Baileys, reaproveitando a sessao salva
 * em WHATSAPP_SESSION_DIR (ou gerando um novo QR Code para escanear caso
 * ainda nao exista sessao). Reconecta automaticamente quando a conexao cai,
 * exceto quando o dispositivo foi deslogado manualmente.
 */
export async function connectToWhatsApp(): Promise<WASocket> {
  const { state, saveCreds } = await useMultiFileAuthState(
    env.whatsappSessionDir
  );
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
    logger: logger.child({ module: "baileys" }) as never,
    printQRInTerminal: false,
  });

  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (qr) {
      logger.info("Escaneie o QR Code abaixo com o WhatsApp do numero dedicado ao bot:");
      qrcodeTerminal.generate(qr, { small: true });
    }

    if (connection === "close") {
      const statusCode = (lastDisconnect?.error as Boom | undefined)?.output
        ?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      logger.warn(
        { statusCode, shouldReconnect },
        "Conexao com o WhatsApp encerrada"
      );

      if (shouldReconnect) {
        connectToWhatsApp().catch((err) =>
          logger.error({ err }, "Falha ao reconectar")
        );
      } else {
        logger.error(
          "Sessao deslogada. Apague o diretorio de sessao e escaneie o QR Code novamente."
        );
      }
    } else if (connection === "open") {
      logger.info("Conectado ao WhatsApp com sucesso");
      resolveFirstConnection();
    }
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    if (type !== "notify") return;

    for (const msg of messages) {
      if (msg.key.fromMe) continue;

      const from = msg.key.remoteJid;
      const text =
        msg.message?.conversation ??
        msg.message?.extendedTextMessage?.text ??
        "";

      if (!from || !text) continue;

      logger.debug({ from, text }, "Mensagem recebida");
      for (const handler of messageHandlers) {
        await handler(from, text.trim());
      }
    }
  });

  return sock;
}

/** Normaliza um numero de telefone (ex: "5511999998888") para o JID do WhatsApp. */
export function numberToJid(number: string): string {
  return number.includes("@") ? number : `${number}@s.whatsapp.net`;
}

/** Envia uma mensagem de texto simples para um JID (numero ou grupo). */
export async function sendText(jid: string, text: string): Promise<void> {
  if (!sock) throw new Error("Socket do WhatsApp ainda nao conectado");
  await sock.sendMessage(jid, { text });
}

/** Envia uma imagem (buscada da `imageUrl`) com legenda para um JID (numero ou grupo). */
export async function sendImage(
  jid: string,
  imageUrl: string,
  caption: string
): Promise<void> {
  if (!sock) throw new Error("Socket do WhatsApp ainda nao conectado");
  await sock.sendMessage(jid, { image: { url: imageUrl }, caption });
}

export function getSocket(): WASocket {
  if (!sock) throw new Error("Socket do WhatsApp ainda nao conectado");
  return sock;
}
