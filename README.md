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
- ✅ **Etapa 2** — Conexão básica com WhatsApp via Baileys
- ✅ **Etapa 3** — Coletor da Promobit
- ✅ **Etapa 4** — Filtro automático (desconto mínimo, preço min/max, blocklist)
- ✅ **Etapa 5** — Fluxo de aprovação via chat privado (fila 1 a 1, resposta 1/2)
- ✅ **Etapa 6** — Gerador de link de afiliado (Amazon)
- ✅ **Etapa 7** — Postagem automática no grupo após aprovação
- 🟡 **Etapa 8** — Novas fontes e plataformas de afiliado: estrutura pronta,
  Pelando implementada porém **bloqueada** (ver observação abaixo)

## Estrutura de pastas

```
/src
  /collectors      → um arquivo por fonte: promobit.ts (ativo), pelando.ts (bloqueada)
  /filters         → regras de filtro automático (src/filters/index.ts)
  /affiliate        → adapters de geração de link por plataforma (amazon.ts)
  /whatsapp        → conexão Baileys, fila de aprovação, postagem no grupo
  /db              → schema e queries do SQLite
  /config          → carregamento e validação de variáveis de ambiente
  /types           → tipos compartilhados (ex: Offer)
  /utils           → utilitários (ex: logger)
  pipeline.ts      → orquestra coleta → filtro → fila de aprovação
  index.ts         → bootstrap geral + scheduler (node-cron)
.env.example
blocklist.json
```

## Fluxo de ponta a ponta

1. **`src/index.ts`** inicializa o banco, conecta ao WhatsApp, liga o listener
   de aprovação e agenda `runCollectionCycle()` (Etapa 3+4) para rodar uma vez
   ao iniciar e depois a cada `COLLECTOR_INTERVAL_MINUTES` via `node-cron`.
2. **`src/pipeline.ts`** roda cada coletor ativo, insere as ofertas novas no
   banco (`insertOfferIfNew`, que ignora duplicatas pelo link original),
   aplica `applyFilters()` em cada uma e:
   - se passar → status `awaiting_approval` + `enqueueForApproval(id)`
   - se não passar → status `discarded` (fica registrada com o motivo nos logs)
3. **`src/whatsapp/approval.ts`** mantém uma fila em memória e envia as
   ofertas **uma de cada vez** para `APPROVAL_NUMBER`, no formato:
   ```
   🔥 [Nome do produto]
   De: R$ XX,XX
   Por: R$ XX,XX (-XX%)
   Fonte: Promobit
   [link original]

   Responda: 1 = aprovar | 2 = rejeitar
   ```
   Só envia a próxima da fila depois que a resposta da atual chega. Resposta
   `1` → `approved` e dispara o callback registrado com `onApproved()`;
   resposta `2` → `rejected`; qualquer outro texto pede para responder de
   novo.
4. **`src/whatsapp/postToGroup.ts`** (ligado como o callback de `onApproved`
   em `index.ts`) gera o link de afiliado (`src/affiliate`), monta a
   mensagem final e posta no `GROUP_ID`, com foto quando disponível:
   ```
   🔥 [Nome do produto]
   ~De: R$ XX,XX~
   Por: R$ XX,XX (-XX%)

   👉 [link de afiliado]
   ```
   Em seguida marca a oferta como `posted`, com `affiliate_link` e
   `posted_at` no banco.

## Módulos por etapa

**Etapa 3 — `src/collectors/promobit.ts`**: em vez de raspar HTML com
seletores CSS (frágil a qualquer mudança de layout), o coletor busca a
página inicial da Promobit e lê o bloco `<script id="__NEXT_DATA__">`
(JSON que o Next.js já embute na página com as ofertas em destaque). Extrai
nome, preço atual/original, link (`/oferta/<slug>/`), imagem e categoria.
Testado contra o site real durante o desenvolvimento.

**Etapa 4 — `src/filters/index.ts`**: aplica, nesta ordem, blocklist de
palavra-chave/categoria (`blocklist.json`, recarregado a cada execução —
editável sem reiniciar o bot), preço mínimo/máximo (`MIN_PRICE`/`MAX_PRICE`)
e desconto mínimo (`MIN_DISCOUNT_PERCENT`). Ofertas sem preço original
conhecido são descartadas por não ser possível confirmar o desconto.

**Etapa 5 — `src/whatsapp/approval.ts`**: fila de aprovação sequencial (só
uma oferta pendente de resposta por vez, para não confundir "1"/"2" com a
oferta errada). Expõe `onApproved()`/`onRejected()` para os próximos passos
se inscreverem na decisão.

**Etapa 6 — `src/affiliate/`**: `types.ts` define a interface
`AffiliateAdapter` (`matches(url)` + `generate(url)`); `amazon.ts` insere
`tag=$AMAZON_AFFILIATE_TAG` na URL (substituindo uma tag existente, se
houver); `index.ts` tem o registro de adapters e `toAffiliateLink()`, que
usa o primeiro adapter compatível ou devolve o link original se nenhum
reconhecer a plataforma. **Para adicionar Shopee/ML/Awin**: criar
`src/affiliate/<plataforma>.ts` implementando `AffiliateAdapter` e
adicionar ao array em `src/affiliate/index.ts` — nenhuma outra mudança é
necessária.

> Observação: a Amazon PA-API oficial (mencionada no projeto original) não
> foi implementada — ela exige credenciais de associado ativo (Access
> Key/Secret Key) e um cliente com assinatura de requisições, que não há
> como testar sem uma conta real. O adapter de afiliado da Amazon (inserir
> `tag=` na URL) funciona independente da API e cobre o caso de uso
> principal: gerar o link de afiliado a partir do link do produto.

**Etapa 7 — `src/whatsapp/postToGroup.ts`**: liga tudo (link de afiliado +
mensagem final + envio com foto) e persiste o resultado.

**Etapa 8 — fontes adicionais**: `src/collectors/pelando.ts` existe com a
interface pronta, mas **está bloqueada**: mesmo a requisição do
`robots.txt` da Pelando retorna um desafio anti-bot do Cloudflare (managed
challenge) em vez do conteúdo, então uma requisição HTTP simples não
consegue ler a página — precisaria de um navegador headless com bypass de
fingerprinting (Playwright + stealth) ou uma API oficial de parceiros, se
existir. Por isso o coletor não está registrado em `src/pipeline.ts` (só a
Promobit roda por enquanto); o arquivo fica pronto para quando essa
limitação for resolvida.

## Configuração (`.env`)

Veja `.env.example` para a lista completa. Resumo:

| Variável | Uso |
|---|---|
| `WHATSAPP_SESSION_DIR` | Onde a sessão do Baileys é persistida |
| `APPROVAL_NUMBER` | Número que recebe as ofertas para aprovar (obrigatório) |
| `GROUP_ID` | Grupo onde as ofertas aprovadas são postadas (obrigatório) |
| `COLLECTOR_INTERVAL_MINUTES` | Intervalo do coletor (padrão 20) |
| `DB_PATH` | Caminho do SQLite |
| `MIN_DISCOUNT_PERCENT` / `MIN_PRICE` / `MAX_PRICE` | Regras do filtro |
| `BLOCKLIST_PATH` | Caminho do `blocklist.json` |
| `AMAZON_AFFILIATE_TAG` | Seu ID de afiliado Amazon (`tag=`) |

## Como rodar

```bash
npm install
cp .env.example .env
# edite o .env: no minimo APPROVAL_NUMBER e GROUP_ID
npm run dev
```

Na primeira execução, um QR Code aparece no terminal — escaneie com o
WhatsApp do número **dedicado ao bot** (não use seu número pessoal, pelo
risco de bloqueio ao usar uma biblioteca não-oficial). Depois disso, a
sessão fica salva em `WHATSAPP_SESSION_DIR` (`./auth_session` por padrão) e
as próximas execuções conectam automaticamente, sem novo QR Code.

Se `GROUP_ID` ainda não estiver no `.env`, o bot conecta, lista no terminal
os grupos que o número já participa (com o ID de cada um) e encerra —
adicione o número do bot a um grupo de teste antes, copie o ID mostrado
para `GROUP_ID` e rode `npm run dev` de novo.

Assim que conectar com `GROUP_ID` configurado, o bot já roda um ciclo de
coleta da Promobit, aplica o filtro e começa a te enviar as ofertas
aprovadas, uma por vez, no número configurado em `APPROVAL_NUMBER`.
Responda `1` para aprovar (ela é postada automaticamente em `GROUP_ID`) ou
`2` para rejeitar.

Para editar as regras de bloqueio sem reiniciar o bot, edite
`blocklist.json` diretamente:

```json
{
  "keywords": ["cigarro eletrônico"],
  "categories": ["Adulto"]
}
```

## Próximos passos sugeridos

- Resolver o bloqueio da Pelando (Playwright com stealth, ou API de
  parceiros) e registrar `pelandoCollector` em `src/pipeline.ts`.
- Implementar a coleta via Amazon PA-API oficial quando houver conta de
  associado ativa.
- Adicionar adapters de afiliado para Shopee, Mercado Livre e Awin
  (`src/affiliate/`).
- Histórico de preço por produto, para detectar "promoção falsa" antes do
  filtro automático.
