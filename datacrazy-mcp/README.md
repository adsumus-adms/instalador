# datacrazy-mcp

Servidor MCP (stdio) que conecta o Claude Code direto à API do CRM Datacrazy.
**Fases 1 e 2: leitura e escrita no CRM.** Não há ferramentas de exclusão, de anexos nem de envio de mensagens (Fase 3, ainda não implementada).

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

## Próxima fase

3. Mensagens (enviar mensagem para uma conversa, finalizar atendimento), com confirmação em cada envio e respeitando a janela de 24h e os templates da Meta.
