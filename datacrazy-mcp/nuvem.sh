#!/bin/sh
# Sobe o MCP em sessões na nuvem (Claude Code na web). Aqui a chave NÃO fica no código nem em variável:
# é um segredo de rede do ambiente e o proxy a injeta nas chamadas a api.g1.datacrazy.io.
# Instala/compila na primeira execução. Tudo que não for o protocolo MCP vai para stderr.
cd "$(dirname "$0")" || exit 1
[ -d node_modules ] || npm ci --silent >&2 || exit 1
[ -f dist/index.js ] || npm run build --silent >&2 || exit 1
export DATACRAZY_AUTH_VIA_PROXY=1
export NODE_USE_ENV_PROXY=1                      # o fetch do Node só usa o proxy do ambiente com isto
export NODE_EXTRA_CA_CERTS="${NODE_EXTRA_CA_CERTS:-/root/.ccr/ca-bundle.crt}"
exec node dist/index.js
