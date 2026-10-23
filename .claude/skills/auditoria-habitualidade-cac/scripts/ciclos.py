#!/usr/bin/env python3
"""Calcula os ciclos de habitualidade (padrão ALFA ou BRAVO) a partir da data de emissão do CR."""
import argparse
import json
from datetime import date, timedelta

CORTE = date(2023, 1, 1)
ALFA_INI = date(2023, 12, 27)


def add_anos(d, n):
    try:
        return d.replace(year=d.year + n)
    except ValueError:  # 29/02
        return d.replace(year=d.year + n, day=28)


def ciclos(inicio, declaracao, primeiro_fim=None):
    out, ini, n = [], inicio, 1
    while ini <= declaracao:
        fim = primeiro_fim if (n == 1 and primeiro_fim) else add_anos(ini, 1) - timedelta(days=1)
        em_aberto = fim > declaracao
        out.append({
            "ciclo": n,
            "inicio": ini.isoformat(),
            "fim": fim.isoformat(),
            "fim_efetivo": min(fim, declaracao).isoformat(),
            "em_aberto": em_aberto,
        })
        ini, n = fim + timedelta(days=1), n + 1
    return out


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--cr-emissao", required=True, help="AAAA-MM-DD")
    p.add_argument("--declaracao", required=True, help="AAAA-MM-DD (data de emissão da declaração)")
    a = p.parse_args()
    cr, decl = date.fromisoformat(a.cr_emissao), date.fromisoformat(a.declaracao)
    if cr < CORTE:
        padrao, lista = "ALFA", ciclos(ALFA_INI, decl)
    else:
        padrao, lista = "BRAVO", ciclos(cr, decl)
    print(json.dumps({"padrao": padrao, "cr_emissao": cr.isoformat(),
                      "declaracao": decl.isoformat(), "ciclos": lista},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
