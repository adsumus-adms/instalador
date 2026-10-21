# JSON de entrada de `scripts/gerar_quadro.py`

```json
{
  "cac": {"nome": "", "cr": "", "emissao_cr": "dd/mm/aaaa", "padrao": "ALFA|BRAVO",
          "filiacao": "", "declaracao_data": "dd/mm/aaaa", "status_analise": "Parcial: faltam folhas e sistema"},
  "armas": [{"sigma": "", "calibre": "", "classificacao": "", "grupo": "", "eventos": 0, "obs": ""}],
  "ciclos": [{"ciclo": 1, "inicio": "dd/mm/aaaa", "fim": "dd/mm/aaaa", "confirmados": 0, "meta": 8,
              "cumpre": "Sim|Não|A confirmar", "obs": ""}],
  "detalhe": [{"ciclo": 1, "data": "dd/mm/aaaa hh:mm", "sigma": "", "calibre": "", "qtd": 0, "evento": "Treinamento",
               "sistema": "Sim|Não|Não verificado", "folha": "Sim|Não|Não verificado", "declaracao": "Sim|Não",
               "situacao": "OK|Sem folha|...", "fonte": "arquivo, pág."}],
  "pendencias": ["texto"]
}
```
- "cumpre" colore a célula: começa com "Sim" verde, com "N" vermelho, outro valor amarelo.
- Sem CPF no quadro: ele é compartilhado.
