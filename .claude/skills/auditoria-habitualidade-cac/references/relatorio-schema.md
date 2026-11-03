# JSON de entrada de `scripts/gerar_relatorio_pdf.py`

Gera o relatório em PDF (A4, para impressão e consulta de quem processa as declarações). Não guarde dados reais de CACs no repositório: o exemplo abaixo é fictício.

## Regra de cor (sempre)
Tudo o que **precisa ser corrigido** sai em **vermelho**, com a palavra **CORRIGIR** (a palavra garante a leitura em impressão preto e branco). O script faz isso sozinho:
- células da tabela de resultado que contêm `<b>Não</b>` (ou `<b>Não ...`);
- ações com `"corrigir": true` (a coluna "Ação" e a prioridade "Alta" ficam em vermelho);
- dias do anexo com `"corrigir": true`.
O que é só conferir ou anexar (`"corrigir": false`) fica em preto. "A confirmar" fica em preto.

## Esquema
```json
{
  "cac": "NOME COMO NO CR", "cr_curto": "000000", "data_analise": "dd/mm/aaaa",
  "cr": "texto da linha do CR", "entidade": "...", "padrao": "ALFA ou BRAVO e ciclos",
  "declaracao": "...", "exigencia": "...", "filiacao": "...", "situacao": "<b>Parcial</b>: ...",
  "documentos": "<b>Documentos analisados:</b> ... <b>Não analisados:</b> ...",
  "conclusao": "texto curto com <b>negrito</b>",
  "resultado": {
    "cabecalho": ["Grupo", "Ciclo 1", "Ciclo 2", "Ciclo 3"], "larguras": [5.6, 4.0, 3.9, 4.3],
    "legenda": "texto", "nota": "texto",
    "linhas": [["<b>1</b> Curta permitida", "5 / 22<br/><b>Não</b>", "9 / 9<br/><b>Sim</b>", "9 / 9<br/><b>Sim</b>"]]
  },
  "acoes": [{"prioridade": "Alta|Média|Baixa", "corrigir": true,
             "declaracao": "o que a declaração mostra", "documentos": "o que os documentos mostram", "acao": "o que fazer"}],
  "armas": {"cabecalho": ["Arma", "Sigma / série", "Registro e CRAF", "Grupo correto", "Guia de trânsito"],
            "larguras": [4.4, 2.6, 3.6, 3.2, 4.0], "linhas": [["...", "...", "...", "...", "..."]], "nota": "texto"},
  "corretos": "texto", "normas": "texto", "premissas": "texto", "limitacoes": "texto",
  "nota_dia_a_dia": "texto", "rodape_anexo": "texto",
  "dia_a_dia": [{"data": "dd/mm/aaaa (hh:mm)", "ciclo": 1, "calibres": "...", "folha": "2025, linhas 01-07",
                 "situacao": "Batem", "corrigir": false}]
}
```
- Use `&amp;` para "&" nos textos (ex.: `.40 S&amp;W`). Tags aceitas: `<b>`, `<br/>`.
- Sem CPF no relatório.
