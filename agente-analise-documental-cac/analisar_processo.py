#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""Motor central de análise documental de processos CAC (Adsumus).

Lê uma pasta local com os documentos de um processo, envia o conteúdo para a
API da Claude junto com o checklist e os critérios de validade, e gera um
relatório (Markdown) com o status do processo: COMPLETO_E_VALIDO, PENDENTE
ou COM_ERRO.

Uso:
    python analisar_processo.py "/caminho/para/Cliente - CR" --tipo CR

    # deixando o script tentar identificar o tipo pelo nome da pasta:
    python analisar_processo.py "/caminho/para/Fulano de Tal - CR"

    # transferência de arma exige indicar o papel do titular da pasta:
    python analisar_processo.py "/caminho/para/pasta" --tipo TRANSFERENCIA --papel receptor

Requer a variável de ambiente ANTHROPIC_API_KEY configurada.
"""

import argparse
import base64
import datetime
import json
import mimetypes
import os
import sys

from checklist import NOMES_TIPO, identificar_tipo_processo, obter_checklist
from prompt_motor_central import SYSTEM_PROMPT

EXTENSOES_SUPORTADAS = {".pdf", ".png", ".jpg", ".jpeg", ".webp", ".gif"}
MODELO_PADRAO = os.environ.get("AGENTE_CAC_MODEL", "claude-sonnet-5")


def parse_args():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("pasta", help="Pasta local com os documentos do processo")
    parser.add_argument(
        "--tipo",
        choices=sorted(NOMES_TIPO),
        help="Tipo de processo. Se omitido, o script tenta identificar pelo nome da pasta.",
    )
    parser.add_argument(
        "--papel",
        choices=["doador", "receptor"],
        help="Obrigatório quando --tipo TRANSFERENCIA: de quem é esta pasta de documentos.",
    )
    parser.add_argument(
        "--cliente",
        help="Nome do cliente/titular do processo (opcional, só entra no relatório).",
    )
    parser.add_argument(
        "--saida",
        help="Caminho do relatório de saída (padrão: RELATORIO_ANALISE.md dentro da própria pasta).",
    )
    parser.add_argument("--model", default=MODELO_PADRAO, help=f"Modelo Claude a usar (padrão: {MODELO_PADRAO})")
    return parser.parse_args()


def resolver_tipo_processo(args):
    tipo = args.tipo
    if tipo is None:
        tipo = identificar_tipo_processo(os.path.basename(os.path.normpath(args.pasta)))
        if tipo is None:
            sys.exit(
                "Não foi possível identificar o tipo de processo pelo nome da pasta.\n"
                "Informe explicitamente com --tipo (" + ", ".join(sorted(NOMES_TIPO)) + ")."
            )
        print(f"Tipo de processo identificado pelo nome da pasta: {NOMES_TIPO[tipo]}")

    if tipo == "TRANSFERENCIA" and not args.papel:
        sys.exit("Para --tipo TRANSFERENCIA é obrigatório informar --papel doador|receptor.")

    return tipo


def listar_arquivos(pasta):
    arquivos = []
    for nome in sorted(os.listdir(pasta)):
        caminho = os.path.join(pasta, nome)
        if not os.path.isfile(caminho):
            continue
        _, ext = os.path.splitext(nome)
        if ext.lower() not in EXTENSOES_SUPORTADAS:
            print(f"Aviso: ignorando arquivo com extensão não suportada: {nome}")
            continue
        arquivos.append(caminho)
    return arquivos


def montar_blocos_arquivos(caminhos):
    blocos = []
    for caminho in caminhos:
        nome = os.path.basename(caminho)
        mime, _ = mimetypes.guess_type(nome)
        with open(caminho, "rb") as f:
            dados_b64 = base64.standard_b64encode(f.read()).decode("ascii")

        blocos.append({"type": "text", "text": f"Arquivo enviado pelo cliente: {nome}"})
        if mime == "application/pdf":
            blocos.append(
                {
                    "type": "document",
                    "source": {"type": "base64", "media_type": "application/pdf", "data": dados_b64},
                }
            )
        elif mime and mime.startswith("image/"):
            blocos.append(
                {
                    "type": "image",
                    "source": {"type": "base64", "media_type": mime, "data": dados_b64},
                }
            )
        else:
            print(f"Aviso: tipo de arquivo não reconhecido para {nome} ({mime}), pulando.")
            blocos.pop()  # remove o texto "Arquivo enviado..." que acabamos de adicionar
    return blocos


def chamar_motor_central(tipo, checklist_docs, blocos_arquivos, model):
    try:
        import anthropic
    except ImportError:
        sys.exit(
            "Pacote 'anthropic' não instalado. Rode: pip install -r requirements.txt"
        )

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        sys.exit("Variável de ambiente ANTHROPIC_API_KEY não configurada.")

    client = anthropic.Anthropic(api_key=api_key)

    hoje = datetime.date.today().strftime("%d/%m/%Y")
    contexto = {
        "tipo_processo": NOMES_TIPO[tipo],
        "checklist_documentos_exigidos": checklist_docs,
        "data_de_hoje": hoje,
    }

    conteudo = [{"type": "text", "text": json.dumps(contexto, ensure_ascii=False, indent=2)}]
    if blocos_arquivos:
        conteudo.extend(blocos_arquivos)
    else:
        conteudo.append({"type": "text", "text": "Nenhum arquivo foi enviado pelo cliente até o momento."})

    resposta = client.messages.create(
        model=model,
        max_tokens=4096,
        system=SYSTEM_PROMPT,
        messages=[{"role": "user", "content": conteudo}],
    )

    texto_resposta = "".join(bloco.text for bloco in resposta.content if bloco.type == "text")
    try:
        return json.loads(texto_resposta)
    except json.JSONDecodeError:
        sys.exit(
            "O modelo não retornou um JSON válido. Resposta bruta:\n\n" + texto_resposta
        )


def gerar_relatorio(resultado, tipo, cliente, pasta):
    linhas = []
    linhas.append(f"# Relatório de análise documental — {NOMES_TIPO[tipo]}")
    linhas.append("")
    if cliente:
        linhas.append(f"**Cliente:** {cliente}")
    linhas.append(f"**Pasta analisada:** {pasta}")
    linhas.append(f"**Data da análise:** {datetime.date.today().strftime('%d/%m/%Y')}")
    linhas.append(f"**Status do processo:** {resultado.get('status_processo', 'DESCONHECIDO')}")
    linhas.append("")
    linhas.append("| Documento | Status | Arquivo | Motivo |")
    linhas.append("|---|---|---|---|")
    for doc in resultado.get("documentos", []):
        linhas.append(
            "| {nome} | {status} | {arquivo} | {motivo} |".format(
                nome=doc.get("nome_documento", ""),
                status=doc.get("status", ""),
                arquivo=doc.get("arquivo_correspondente") or "—",
                motivo=(doc.get("motivo") or "—").replace("\n", " "),
            )
        )
    linhas.append("")
    linhas.append("## Mensagem para o cliente")
    linhas.append("")
    linhas.append(resultado.get("mensagem_cliente", ""))
    linhas.append("")
    return "\n".join(linhas)


def main():
    args = parse_args()
    pasta = os.path.abspath(args.pasta)
    if not os.path.isdir(pasta):
        sys.exit(f"Pasta não encontrada: {pasta}")

    tipo = resolver_tipo_processo(args)
    checklist_docs = obter_checklist(tipo, papel=args.papel if tipo == "TRANSFERENCIA" else None)

    caminhos_arquivos = listar_arquivos(pasta)
    print(f"{len(caminhos_arquivos)} arquivo(s) encontrado(s) em {pasta}")

    blocos_arquivos = montar_blocos_arquivos(caminhos_arquivos)
    resultado = chamar_motor_central(tipo, checklist_docs, blocos_arquivos, args.model)

    relatorio = gerar_relatorio(resultado, tipo, args.cliente, pasta)
    saida = args.saida or os.path.join(pasta, "RELATORIO_ANALISE.md")
    with open(saida, "w", encoding="utf-8") as f:
        f.write(relatorio)

    print()
    print(f"Status do processo: {resultado.get('status_processo', 'DESCONHECIDO')}")
    print(f"Relatório salvo em: {saida}")


if __name__ == "__main__":
    main()
