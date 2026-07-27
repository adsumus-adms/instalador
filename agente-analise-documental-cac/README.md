# Agente de análise documental — Processos CAC (Adsumus)

Script de linha de comando que analisa os documentos de um processo de CAC
(Colecionador, Atirador Desportivo e Caçador) salvos em uma pasta local,
antes do protocolo no SINARM CAC. Ele verifica **presença** (todos os
documentos exigidos foram entregues?) e **validade de conteúdo** (nome, data,
assinatura, prazo) de cada documento, e devolve um relatório com o status do
processo: `COMPLETO_E_VALIDO`, `PENDENTE` ou `COM_ERRO`.

A lógica de checklist e critérios de validade segue a especificação do
"Agente de IA — Análise Documental de Processos CAC" (checklists por tipo de
processo e prazos de validade por documento).

## Instalação

```bash
cd agente-analise-documental-cac
python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # depois preencha ANTHROPIC_API_KEY no .env
export $(grep -v '^#' .env | xargs)   # ou exporte a variável manualmente
```

## Uso

Organize os documentos de cada processo em uma pasta própria (PDFs e/ou
imagens soltos, sem precisar de nome de arquivo padronizado — o agente lê o
conteúdo de cada arquivo para identificar qual documento do checklist ele é).

```bash
python analisar_processo.py "/caminho/para/Fulano de Tal - CR"
```

Se o nome da pasta seguir o padrão `NOME DO CLIENTE - TIPO DE PROCESSO` (o
mesmo "de-para" usado nos títulos de cartão do Trello), o tipo de processo é
identificado automaticamente. Caso contrário, ou para desambiguar, informe
explicitamente:

```bash
python analisar_processo.py "/caminho/para/pasta" --tipo CR --cliente "Fulano de Tal"
```

Tipos aceitos em `--tipo`: `CR`, `AQUISICAO`, `ENDERECO`, `CRAF`,
`TRANSFERENCIA`.

Para **Transferência de arma**, doador e receptor enviam documentos
diferentes — rode uma vez para cada papel, apontando para a respectiva pasta
de documentos:

```bash
python analisar_processo.py "/caminho/doador"   --tipo TRANSFERENCIA --papel doador
python analisar_processo.py "/caminho/receptor" --tipo TRANSFERENCIA --papel receptor
```

## Saída

O script gera `RELATORIO_ANALISE.md` dentro da própria pasta analisada (ou no
caminho passado em `--saida`), com:

- Status do processo (`COMPLETO_E_VALIDO` / `PENDENTE` / `COM_ERRO`).
- Tabela com cada documento do checklist: status, arquivo correspondente
  encontrado e motivo (quando pendente ou com erro).
- Uma mensagem pronta para ser enviada ao cliente com o que falta ou precisa
  ser corrigido.

Quando o processo é classificado como `COMPLETO_E_VALIDO`, o script também
monta a **pasta pronta para protocolo**: copia cada documento (sem alterar o
original) para uma subpasta `PRONTO_PARA_PROTOCOLAR/` dentro da pasta
analisada, renomeado e numerado na ordem do checklist — ex:
`01_laudo_de_tiro.pdf`, `02_certidao_federal.pdf` — pronta para upload
individual no SINARM. Use `--pasta-final` para escolher outro destino.

## Arquivos

- `analisar_processo.py` — script principal (CLI).
- `checklist.py` — checklists por tipo de processo e tabela de identificação
  de tipo de processo a partir de texto livre (nome de pasta/cartão).
- `prompt_motor_central.py` — instruções e critérios de validade enviados ao
  modelo (prazos de validade, regras de decisão).

## Limitações conhecidas

- O agente nunca aprova um documento em caso de dúvida — classifica como
  `COM_ERRO` e explica a dúvida, para revisão humana.
- A pasta pronta para protocolo é sempre gerada localmente (não há
  integração com Google Drive ou Trello neste script).
