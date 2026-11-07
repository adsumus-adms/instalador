#!/usr/bin/env python3
"""Consolida vendas do mês (clube e loja) e calcula os indicadores do balanço.

Entrada: um ou mais CSVs (separador , ou ;) com as colunas abaixo, já normalizados.
  unidade    clube | loja
  data       AAAA-MM-DD (ou DD/MM/AAAA)
  venda_id   identificador da venda/comprovante (para contar vendas e ticket médio)
  cliente_id identificador do cliente (opcional; só para ticket por cliente, não vai ao relatório)
  categoria  municao | arma | outro
  calibre    texto livre; é normalizado por references/calibres.md (ver ALIASES abaixo)
  descricao  nome do item
  qtd        quantidade vendida (para munição: unidades/cartuchos se souber; senão caixas)
  receita    valor vendido do item (total da linha, já com desconto)
  custo      custo total da linha (vazio se desconhecido)

Saída: JSON em stdout (ou --saida) com agregados. Nenhum dado pessoal é emitido.
Uso: python3 consolidar.py vendas.csv [mais.csv] [--anterior mes_anterior.csv] [--saida r.json]
"""
import argparse, csv, json, re, sys
from collections import defaultdict
from datetime import datetime

ALIASES = [  # (regex em minúsculas sem espaços/pontos -> nome canônico)
    (r"^(380|380acp|380auto|9mmcurto|9x17)$", ".380 ACP"),
    (r"^(9mm|9x19|9mmluger|9mmpara|9parabellum)$", "9mm Luger"),
    (r"^(38|38spl|38special|38especial)$", ".38 SPL"),
    (r"^(357|357mag|357magnum)$", ".357 Magnum"),
    (r"^(40|40sw|40s&w)$", ".40 S&W"),
    (r"^(45|45acp|45auto)$", ".45 ACP"),
    (r"^(22|22lr|22longrifle)$", ".22 LR"),
    (r"^(223|223rem|556|556x45|556nato)$", ".223 Rem / 5.56"),
    (r"^(762x39|762)$", "7,62x39"),
    (r"^(308|308win|762x51)$", ".308 Win / 7,62x51"),
    (r"^(12|12ga|12gauge|cal12|calibre12)$", "12 GA"),
    (r"^(20|20ga|cal20)$", "20 GA"),
]

def norm_cal(txt):
    if not txt or not txt.strip():
        return "Sem calibre"
    k = re.sub(r"[\s\.,\-_/]", "", txt.lower())
    for rx, nome in ALIASES:
        if re.match(rx, k):
            return nome
    return txt.strip()  # desconhecido: mantém o texto para o usuário conferir

def num(s):
    if s is None or str(s).strip() == "":
        return None
    s = str(s).strip().replace("R$", "").replace(" ", "")
    if "," in s:
        s = s.replace(".", "").replace(",", ".")
    return float(s)

def lê(paths):
    linhas = []
    for p in paths:
        with open(p, newline="", encoding="utf-8-sig") as f:
            amostra = f.read(2048); f.seek(0)
            dialect = csv.Sniffer().sniff(amostra, delimiters=",;\t")
            for r in csv.DictReader(f, dialect=dialect):
                r = {k.strip().lower(): (v or "").strip() for k, v in r.items() if k}
                linhas.append(dict(
                    unidade=r.get("unidade", "").lower(), venda=r.get("venda_id", ""),
                    cliente=r.get("cliente_id", ""), cat=r.get("categoria", "").lower(),
                    cal=norm_cal(r.get("calibre", "")), desc=r.get("descricao", ""),
                    qtd=num(r.get("qtd")) or 0.0, rec=num(r.get("receita")) or 0.0,
                    custo=num(r.get("custo"))))
    return linhas

def agrega(rows):
    t = dict(receita=0.0, custo=0.0, receita_com_custo=0.0, qtd=0.0, itens=0, sem_custo=0)
    for r in rows:
        t["receita"] += r["rec"]; t["qtd"] += r["qtd"]; t["itens"] += 1
        if r["custo"] is None:
            t["sem_custo"] += 1
        else:
            t["custo"] += r["custo"]; t["receita_com_custo"] += r["rec"]
    lucro = t["receita_com_custo"] - t["custo"]
    t["lucro"] = round(lucro, 2)
    # Margem ponderada = lucro / receita, só sobre linhas com custo conhecido
    t["margem_pct"] = round(100 * lucro / t["receita_com_custo"], 1) if t["receita_com_custo"] else None
    for k in ("receita", "custo", "receita_com_custo", "qtd"):
        t[k] = round(t[k], 2)
    return t

def por_calibre(rows):
    g = defaultdict(list)
    for r in rows: g[r["cal"]].append(r)
    out = [dict(calibre=c, **agrega(v)) for c, v in g.items()]
    return sorted(out, key=lambda x: -x["qtd"])

def bloco(rows):
    vendas = {r["venda"] for r in rows if r["venda"]}
    clientes = {r["cliente"] for r in rows if r["cliente"]}
    receita = sum(r["rec"] for r in rows)
    mun = [r for r in rows if r["cat"] == "municao"]
    arm = [r for r in rows if r["cat"] == "arma"]
    mmin = [r for r in rows if r["custo"] is not None and r["rec"] > 0]
    margens = [100 * (r["rec"] - r["custo"]) / r["rec"] for r in mmin]
    return dict(
        total=agrega(rows),
        n_vendas=len(vendas),
        ticket_medio_por_venda=round(receita / len(vendas), 2) if vendas else None,
        n_clientes=len(clientes) or None,
        ticket_medio_por_cliente=round(receita / len(clientes), 2) if clientes else None,
        municao=dict(resumo=agrega(mun), por_calibre=por_calibre(mun)),
        armas=dict(resumo=agrega(arm), por_calibre=por_calibre(arm),
                   unidades=round(sum(r["qtd"] for r in arm), 2)),
        margem_media_simples_pct=round(sum(margens) / len(margens), 1) if margens else None,
        vendas_abaixo_do_custo=[dict(descricao=r["desc"], calibre=r["cal"], receita=r["rec"], custo=r["custo"])
                                for r in rows if r["custo"] is not None and r["rec"] < r["custo"]][:20],
        itens_sem_custo=sum(1 for r in rows if r["custo"] is None),
        calibres_nao_reconhecidos=sorted({r["cal"] for r in rows if r["cat"] == "municao"
                                          and r["cal"] != "Sem calibre"
                                          and not any(re.match(rx, re.sub(r"[\s\.,\-_/]", "", r["cal"].lower())) for rx, _ in ALIASES)
                                          and r["cal"] not in {n for _, n in ALIASES}}),
    )

def resumo(rows):
    return {u: bloco([r for r in rows if r["unidade"] == u]) for u in ("clube", "loja")
            if any(r["unidade"] == u for r in rows)}

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("csvs", nargs="+")
    ap.add_argument("--anterior", nargs="*", default=[], help="CSVs do mês anterior, para variação")
    ap.add_argument("--saida")
    a = ap.parse_args()
    res = dict(mes_atual=resumo(lê(a.csvs)))
    if a.anterior:
        res["mes_anterior"] = resumo(lê(a.anterior))
    txt = json.dumps(res, ensure_ascii=False, indent=2)
    (open(a.saida, "w", encoding="utf-8").write(txt) if a.saida else print(txt))

if __name__ == "__main__":
    main()
