# Teste de envio de mensagem (Fase 3)

Objetivo: provar que o envio funciona de ponta a ponta **mandando uma mensagem para o seu próprio
WhatsApp**, antes de qualquer cliente real. Também testamos que as travas recusam o que devem.

## Antes de começar (você, no celular)

1. Do **seu celular pessoal**, mande uma mensagem (ex.: "teste") para o número do clube conectado ao Datacrazy:
   **+55 83 9980-3977** (conexão `ADSUMUS_3977`). Isso abre a janela de 24h e cria a conversa.
2. Confirme no Datacrazy que a conversa apareceu. Não use cliente real em nenhum passo.

## No Claude Code (sessão NOVA, ambiente CLAUDE IA, branch `claude/sharp-thompson-u545mk`)

O envio fica ligado pelo `.mcp.json` (`DATACRAZY_PERMITIR_ENVIO=1`). Só vale em sessão nova.

**Teste A: recusa fora da janela (seguro, não envia nada)**
Peça: "Pegue uma conversa antiga (finalizada, sem mensagem nas últimas 24h) e rode `preparar_mensagem`
com o texto 'teste'". Esperado: recusa com "Janela de 24h NÃO confirmada" e nenhum código.

**Teste B: envio real para o seu número**
1. Peça: "Ache a conversa do meu número (55 83 ........) e rode `preparar_mensagem` com o texto
   'Teste do MCP Datacrazy, pode ignorar'."
2. Confira o que a sessão mostrar: **telefone = o seu**, **enviado por +55 83 9980-3977**, texto exato,
   janela aberta. Se qualquer coisa estiver diferente, **responda "não"**.
3. Responda "sim, pode enviar". O Claude Code vai pedir sua permissão mais uma vez (mostrando texto e conversa): aprove.
4. Veja a mensagem chegar no seu celular, e confira no Datacrazy o status da entrega.

**Teste C: travas (opcional, seguro com o seu número)**
- Peça para enviar com o texto **alterado** depois de preparar: deve recusar.
- Peça para reenviar o **mesmo código**: deve recusar (código de uso único).

## Depois do teste

- Para **desligar o envio**, diga na sessão: "desligue o envio no `.mcp.json`" (volta para somente leitura).
- Se algo estranho acontecer (mensagem duplicada, para o número errado, status de erro): pare, não
  tente de novo, e me mostre o que apareceu.

## O que este teste NÃO cobre

- Template da Meta fora da janela (a API não envia template).
- Anexos, agendamento e Instagram (bloqueados de propósito).
- `finalizar_atendimento`: ele pode disparar automações (ex.: pesquisa de satisfação). Teste só com a conversa do
  seu número e só se quiser, depois de conferir no Datacrazy se há automação ligada ao fim do atendimento.
