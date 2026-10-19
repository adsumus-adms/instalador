# Datacrazy (CRM da Adsumus)

Em sessões na nuvem, o acesso à API do Datacrazy já está configurado no ambiente (segredo de rede para
`api.g1.datacrazy.io`). Nunca peça nem escreva a chave; ela não aparece para a sessão.

- Código do MCP: `datacrazy-mcp/` (ver o README de lá). Por padrão só leitura (`.mcp.json`).
- Se as ferramentas `datacrazy` não estiverem disponíveis na sessão, consulte pelo script:
  `cd datacrazy-mcp && node scripts/consultar.mjs buscar_leads '{"take":5}'`
  (na primeira vez rode `npm ci && npm run build`; o fetch precisa de `NODE_USE_ENV_PROXY=1`, que o script já define).
- Limites da API: 60 req/min por rota, 20 req/min em conversas.
- Dados de clientes (nome, telefone, conversas): mostrar só o necessário e nunca gravar em arquivos do repositório.
- Escrita no CRM só quando o usuário pedir e confirmar.
- Permissão fixa em `.claude/settings.json` (autorizada pelo dono): só **criar tags**, **criar motivos de perda** e **apagar tags**, por `curl` direto à API do Datacrazy. Mesmo assim: conferir antes (nome já existe? tag tem leads ou negócios?), nunca apagar tag com uso e dizer ao usuário o que foi feito. Qualquer outra escrita (leads, negócios, conversas, mensagens) não está liberada.
- Mensagens a clientes (só existem com `DATACRAZY_PERMITIR_ENVIO=1`): sempre `preparar_mensagem` primeiro, mostre ao usuário o destinatário e o texto EXATOS e só chame `enviar_mensagem` depois de um "sim" explícito dele para aquele envio. Nunca reutilize uma aprovação para outro texto ou outra conversa, nunca envie em lote, nunca envie por conta própria. Se a janela de 24h estiver fechada, não há como enviar por aqui (a API não envia template): avise o usuário.
