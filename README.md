# Bot de Monitoramento de Ofertas com Aprovação via WhatsApp

Monitora ofertas em fontes públicas, filtra automaticamente, envia para
aprovação manual no WhatsApp privado, converte o link em link de afiliado e
posta a oferta aprovada em um grupo do WhatsApp.

Fluxo completo (visão geral do projeto):

```
[Fontes de ofertas] → [Coletor] → [Filtro automático] → [Fila de aprovação no WhatsApp privado] → [Gerador de link afiliado] → [Post automático no grupo]
```

## Status atual

- ✅ **Etapa 1** — Setup do projeto (Node + TypeScript + SQLite)
- ✅ **Etapa 2** — Conexão básica com WhatsApp via Baileys (enviar/receber mensagem de teste)
- ⬜ Etapa 3 — Coletor de uma fonte (Promobit)
- ⬜ Etapa 4 — Filtro automático (desconto mínimo)
- ⬜ Etapa 5 — Fluxo de aprovação via chat privado
- ⬜ Etapa 6 — Gerador de link de afiliado (Amazon)
- ⬜ Etapa 7 — Postagem automática no grupo
- ⬜ Etapa 8 — Novas fontes e plataformas de afiliado

## Estrutura de pastas

```
/src
  /collectors      → um arquivo por fonte (promobit.ts, pelando.ts, amazon.ts) — Etapa 3
  /filters         → regras de filtro automático — Etapa 4
  /affiliate       → adapters de geração de link por plataforma — Etapa 6
  /whatsapp        → conexão Baileys, envio de aprovação, envio ao grupo
  /db              → schema e queries
  /config          → carregamento e validação de variáveis de ambiente
  /types           → tipos compartilhados (ex: Offer)
  /utils           → utilitários (ex: logger)
  index.ts         → orquestração geral (scheduler)
.env.example
blocklist.json
```

## O que foi implementado nesta etapa

**`package.json` / `tsconfig.json`** — projeto Node + TypeScript. Dependências
principais: `@whiskeysockets/baileys` (WhatsApp), `better-sqlite3` (banco de
dados), `dotenv` (variáveis de ambiente), `pino` (logs), `node-cron`
(scheduler, será usado a partir da Etapa 3).

**`src/config/env.ts`** — lê e centraliza as variáveis do `.env`. Nenhuma
credencial fica hardcoded no código; tudo vem de variáveis de ambiente
(`WHATSAPP_SESSION_DIR`, `APPROVAL_NUMBER`, `GROUP_ID`, etc.), conforme
pedido no projeto original.

**`src/db/schema.ts`** — abre o banco SQLite (`better-sqlite3`) e garante a
tabela `offers`, com os campos definidos no projeto: nome do produto, preço
atual/original, link original, imagem, fonte, timestamp de coleta, status
(`pending_review` → `awaiting_approval` → `approved`/`rejected`/`discarded`
→ `posted`), link de afiliado e data de postagem. `original_link` é `UNIQUE`
para evitar duplicatas na coleta (usado a partir da Etapa 3).

**`src/types/offer.ts`** — tipo TypeScript `Offer`, espelhando a tabela do
banco, para ser reaproveitado pelos módulos de coleta, filtro e aprovação.

**`src/whatsapp/connection.ts`** — conexão com o WhatsApp via Baileys:
- `connectToWhatsApp()`: autentica usando `useMultiFileAuthState` (sessão
  persistida em `WHATSAPP_SESSION_DIR`, fora do controle de versão). Na
  primeira execução, imprime um QR Code no terminal para escanear com o
  número **dedicado** do bot. Reconecta automaticamente quando a conexão
  cai, exceto quando a sessão é deslogada manualmente (nesse caso é preciso
  apagar a pasta de sessão e escanear o QR Code de novo).
- `onMessage(handler)`: registra um callback chamado para cada mensagem de
  texto recebida (base para o fluxo de aprovação 1/2 da Etapa 5).
- `sendText(jid, texto)`: envia uma mensagem de texto simples.
- `numberToJid(numero)`: converte um número (`55DDDNUMERO`) no JID usado
  pelo WhatsApp.

**`src/index.ts`** — orquestração geral: inicializa o banco, conecta ao
WhatsApp, registra um "eco" de teste (responde qualquer mensagem recebida
repetindo o texto) e, se `APPROVAL_NUMBER` estiver configurado, envia uma
mensagem de teste assim que a conexão abrir. Isso valida o envio e o
recebimento de mensagens de ponta a ponta antes de implementarmos o fluxo
real de aprovação.

**`blocklist.json`** — arquivo de configuração (ainda vazio) para
palavras-chave/categorias bloqueadas, usado a partir da Etapa 4.

## Como rodar

```bash
npm install
cp .env.example .env
# edite o .env: pelo menos APPROVAL_NUMBER para testar o envio automático
npm run dev
```

Na primeira execução, um QR Code aparece no terminal — escaneie com o
WhatsApp do número **dedicado ao bot** (não use seu número pessoal, pelo
risco de bloqueio ao usar uma biblioteca não-oficial). Depois disso, a
sessão fica salva em `WHATSAPP_SESSION_DIR` (`./auth_session` por padrão) e
as próximas execuções conectam automaticamente, sem novo QR Code.

Para testar o fluxo: envie qualquer mensagem de texto para o número do bot
a partir do seu WhatsApp pessoal — ele deve responder com `Eco: <sua
mensagem>`. Se `APPROVAL_NUMBER` estiver configurado no `.env`, o bot também
envia uma mensagem de teste para esse número assim que conectar.

## Próximos passos

Etapa 3: implementar o coletor da Promobit (`src/collectors/promobit.ts`),
persistindo as ofertas coletadas na tabela `offers` com status
`pending_review`, respeitando `robots.txt` e limites razoáveis de
requisição.
