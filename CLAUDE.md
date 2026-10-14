# Datacrazy (CRM da Adsumus)

Em sessões na nuvem, o acesso à API do Datacrazy já está configurado no ambiente (segredo de rede para
`api.g1.datacrazy.io`). Nunca peça nem escreva a chave; ela não aparece para a sessão.

- Código do MCP: `datacrazy-mcp/` (ver o README de lá). Por padrão só leitura (`.mcp.json`).
- Se as ferramentas `datacrazy` não estiverem disponíveis na sessão, consulte pelo script:
  `cd datacrazy-mcp && node scripts/consultar.mjs buscar_leads '{"take":5}'`
  (na primeira vez rode `npm ci && npm run build`; o fetch precisa de `NODE_USE_ENV_PROXY=1`, que o script já define).
- Limites da API: 60 req/min por rota, 20 req/min em conversas.
- Dados de clientes (nome, telefone, conversas): mostrar só o necessário e nunca gravar em arquivos do repositório.
- Escrita no CRM só quando o usuário pedir e confirmar; nunca enviar mensagens a clientes sem confirmação explícita.
