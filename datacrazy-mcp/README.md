# datacrazy-mcp

Servidor MCP (stdio) que conecta o Claude Code direto à API do CRM Datacrazy.
**Fases 1 e 2: leitura e escrita no CRM.** Não há ferramentas de exclusão nem de anexos. A Fase 3 (envio de mensagens) existe, mas vem **desligada** até você ativá-la (ver abaixo).

## Instalação

```bash
cd datacrazy-mcp
npm install
npm run build
```

## Chave de API

Gere em https://crm.datacrazy.io/config/api (Configurações > Chaves de API). Ela é exibida uma única vez.
A chave vai **somente** na variável de ambiente `DATACRAZY_API_KEY` (enviada como `Authorization: Bearer`).
Nunca a coloque no código, em logs ou em arquivo versionado.

## Registro no Claude Code

Com a variável já exportada no seu shell:

```bash
claude mcp add datacrazy --scope user -e DATACRAZY_API_KEY="$DATACRAZY_API_KEY" -- node /caminho/absoluto/datacrazy-mcp/dist/index.js
```

Depois rode `/mcp` no Claude Code: o servidor `datacrazy` deve aparecer conectado.
Teste: "liste os 5 leads mais recentes do Datacrazy".

## Uso na nuvem (Claude Code na web), sem instalar nada

A chave fica num **segredo de rede** do ambiente (Bearer, `Authorization`, site `api.g1.datacrazy.io`) e o proxy a injeta nas chamadas. O MCP não vê a chave: `DATACRAZY_AUTH_VIA_PROXY=1` faz ele não enviar o cabeçalho.

- `nuvem.sh` instala, compila e sobe o servidor com as variáveis certas (`NODE_USE_ENV_PROXY=1`, necessário para o `fetch` do Node usar o proxy). O `.mcp.json` na raiz do repositório o registra em modo **somente leitura**.
- Sem o MCP carregado, qualquer sessão consulta direto: `node scripts/consultar.mjs buscar_leads '{"take":5}'`.
- Para liberar escrita na nuvem, remova `DATACRAZY_SOMENTE_LEITURA` do `.mcp.json`.

## Ferramentas (Fase 1)

| Ferramenta | O que faz |
|---|---|
| `buscar_leads`, `buscar_lead_por_id` | Leads (busca por nome/telefone/e-mail/CPF-CNPJ, filtros) |
| `historico_do_lead`, `comentarios_do_lead`, `atividades_do_lead`, `negocios_do_lead` | Dados de um lead |
| `buscar_negocios`, `buscar_negocio_por_id` | Negócios |
| `buscar_pipelines`, `etapas_do_pipeline` | Funis e etapas |
| `buscar_tags`, `buscar_listas`, `buscar_produtos`, `buscar_motivos_de_perda`, `buscar_atividades` | Cadastros |
| `buscar_conversas`, `mensagens_da_conversa` | Conversas (limite da API: 20 req/min) |
| `buscar_atendentes_crm`, `buscar_atendentes_multiatendimento`, `buscar_instancias` | Atendentes e conexões |

## Ferramentas de escrita (Fase 2)

Todas começam com "ESCREVE NO CRM" na descrição e são marcadas como não somente leitura, então o Claude Code pede sua confirmação antes de cada uso. Nenhuma envia mensagem ao cliente.

| Ferramenta | Efeito |
|---|---|
| `criar_lead`, `atualizar_lead` | Cria um lead / altera só os campos informados (tags e listas podem substituir as atuais) |
| `adicionar_comentario_ao_lead` | Nota interna no lead |
| `criar_atividade`, `atualizar_atividade` | Tarefa vinculada a um lead |
| `criar_negocio`, `atualizar_negocio` | Negócio em uma etapa do funil |
| `mover_negocios` | Muda a etapa (pode disparar automações da etapa de destino) |
| `ganhar_negocios`, `perder_negocios`, `restaurar_negocios` | Fecha como ganho / perdido (com motivo) / reabre |

Limites de segurança: no máximo 20 negócios por chamada, IDs validados, entradas inválidas são recusadas antes de chamar a API.

Para usar só leitura, defina `DATACRAZY_SOMENTE_LEITURA=1` (as ferramentas de escrita nem são registradas):

```bash
claude mcp add datacrazy --scope user -e DATACRAZY_API_KEY="$DATACRAZY_API_KEY" -e DATACRAZY_SOMENTE_LEITURA=1 -- node /caminho/absoluto/datacrazy-mcp/dist/index.js
```

## Comportamento

- `429`: espera o `Retry-After` (máx. 60 s) e tenta de novo, até 3 vezes.
- Respostas resumidas: `take` padrão 10 (máx. 50), textos cortados em 300 caracteres, listas em 25 itens.
- Filtros: objeto `filter` vira `filter[chave]=valor` (ver `essencials/use-filters` na documentação).
- Mensagens de erro não incluem o corpo da resposta (pode ter dados de clientes). Única exceção: em erro 4xx de escrita, mostra o `message` de validação da API (ex.: campo inválido), cortado em 300 caracteres.
- `DATACRAZY_BASE_URL` (opcional) sobrescreve `https://api.g1.datacrazy.io`.

## Testes

```bash
npm run build && npm test
```

## Mensagens ao cliente (Fase 3) — desligada por padrão

A mensagem **sai de verdade pelo WhatsApp e não dá para desfazer**. Por isso só existe com `DATACRAZY_PERMITIR_ENVIO=1` (e nunca junto de `DATACRAZY_SOMENTE_LEITURA=1`, que sempre vence).

| Ferramenta | O que faz |
|---|---|
| `preparar_mensagem` | Passo 1. **Não envia.** Confere a janela de 24h, mostra destinatário e texto exatos e devolve um código |
| `enviar_mensagem` | Passo 2. Envia, só com o código + a mesma conversa + o mesmo texto |
| `finalizar_atendimento` | Finaliza a conversa (exige `confirmar: true`; pode disparar automações, ex.: pesquisa de satisfação) |

Travas no código, não só na descrição:
- **Dois passos obrigatórios.** O código é de uso único, vale 15 min e é amarrado à conversa e ao texto. Qualquer diferença recusa o envio e queima o código.
- **Janela de 24h.** A conversa precisa estar entre as que receberam mensagem do cliente nas últimas 24h (filtro `openWindow=last24h`) e a data da última mensagem é conferida de novo. Fora da janela ou sem confirmar, nem gera código. A API do Datacrazy só aceita texto livre, **não envia template da Meta**: fora da janela use o template direto no Datacrazy.
- **Uma conversa por chamada, só texto** (sem anexos, sem agendamento, sem nota interna). Máx. 1000 caracteres.
- **Limite de 20 envios por hora** (`DATACRAZY_MAX_ENVIOS_POR_HORA` ajusta). Evita laço descontrolado.
- Se a chamada falhar sem resposta clara, o resultado vem como **incerto**: confira a conversa antes de reenviar.
- O Claude Code ainda pede sua confirmação em cada chamada de `enviar_mensagem`, e ela mostra o texto e a conversa.

Para ligar no Claude Code local, registre assim (sem `DATACRAZY_SOMENTE_LEITURA`):

```bash
claude mcp add datacrazy --scope user -e DATACRAZY_API_KEY='...' -e DATACRAZY_PERMITIR_ENVIO=1 -- node /caminho/absoluto/datacrazy-mcp/dist/index.js
```

Na nuvem, edite o `.mcp.json` da raiz: troque `"DATACRAZY_SOMENTE_LEITURA": "1"` por `"DATACRAZY_PERMITIR_ENVIO": "1"`.

Limites conhecidos: não testado contra o WhatsApp real (só contra API simulada). Não há como enviar template ou anexo por esta API/ferramenta. Não use para disparo em massa ou marketing (regras da Meta).
