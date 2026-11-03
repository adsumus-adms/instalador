#!/usr/bin/env python3
"""Gera o relatório de análise de habitualidade em PDF (A4, para impressão).

Uso: python3 -I scripts/gerar_relatorio_pdf.py entrada.json saida.pdf
Esquema do JSON: ver references/relatorio-schema.md

Regra de cor: tudo o que precisa ser corrigido sai em VERMELHO e com a palavra CORRIGIR
(a palavra garante a leitura em impressão preto e branco).
"""
import json
import sys

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import cm
from reportlab.pdfgen import canvas
from reportlab.platypus import (BaseDocTemplate, Frame, LongTable, PageBreak, PageTemplate,
                                Paragraph, Spacer, TableStyle)

D = json.load(open(sys.argv[1], encoding="utf-8"))
OUT = sys.argv[2]
CAC = D["cac"]

INK = colors.HexColor("#1b1b1b")
AZ = colors.HexColor("#1F3F73")
CINZA = colors.HexColor("#e9ebf0")
LINHA = colors.HexColor("#9aa0ac")
VERM = "#b00020"
VERM_BG = colors.HexColor("#fbe3e3")

base = ParagraphStyle("b", fontName="Helvetica", fontSize=9, leading=12, textColor=INK)
small = ParagraphStyle("s", parent=base, fontSize=7.6, leading=9.6)
tiny = ParagraphStyle("t", parent=base, fontSize=7, leading=8.8)
cell = ParagraphStyle("c", parent=base, fontSize=8.2, leading=10.2)
h1 = ParagraphStyle("h1", parent=base, fontName="Helvetica-Bold", fontSize=18, leading=22, textColor=AZ, spaceAfter=4)
h2 = ParagraphStyle("h2", parent=base, fontName="Helvetica-Bold", fontSize=12, leading=15, textColor=AZ, spaceBefore=12, spaceAfter=5, keepWithNext=1)
hdr = ParagraphStyle("hd", parent=small, fontName="Helvetica-Bold", textColor=colors.white)
hdr9 = ParagraphStyle("hd9", parent=base, fontName="Helvetica-Bold", textColor=colors.white, fontSize=8.4, leading=10.4)


def P(t, st=base):
    return Paragraph(t, st)


def verm(t):
    return f'<font color="{VERM}"><b>{t}</b></font>'


class NC(canvas.Canvas):
    def __init__(self, *a, **k):
        super().__init__(*a, **k)
        self._pages = []

    def showPage(self):
        self._pages.append(dict(self.__dict__))
        self._startPage()

    def save(self):
        n = len(self._pages)
        for st in self._pages:
            self.__dict__.update(st)
            self.draw(n)
            super().showPage()
        super().save()

    def draw(self, n):
        self.setStrokeColor(LINHA)
        self.setLineWidth(0.5)
        self.line(1.6 * cm, 28.2 * cm, 19.4 * cm, 28.2 * cm)
        self.setFont("Helvetica", 7.5)
        self.setFillColor(INK)
        self.drawString(1.6 * cm, 28.35 * cm, f"Relatório de análise de habitualidade  |  {CAC}  |  CR {D.get('cr_curto', '')}")
        self.line(1.6 * cm, 1.5 * cm, 19.4 * cm, 1.5 * cm)
        self.drawString(1.6 * cm, 1.05 * cm, f"Análise de {D.get('data_analise', '')}. Apoio à conferência: a responsabilidade pela declaração é do clube e do CAC.")
        self.drawRightString(19.4 * cm, 1.05 * cm, f"Página {self._pageNumber} de {n}")


def tbl(data, widths, header=True, zebra=False, extra=None):
    t = LongTable(data, colWidths=[w * cm for w in widths], repeatRows=1 if header else 0)
    st = [("GRID", (0, 0), (-1, -1), 0.4, LINHA), ("VALIGN", (0, 0), (-1, -1), "TOP"),
          ("LEFTPADDING", (0, 0), (-1, -1), 3.5), ("RIGHTPADDING", (0, 0), (-1, -1), 3.5),
          ("TOPPADDING", (0, 0), (-1, -1), 2.6), ("BOTTOMPADDING", (0, 0), (-1, -1), 2.6)]
    if header:
        st.append(("BACKGROUND", (0, 0), (-1, 0), AZ))
    if zebra:
        st.append(("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#f4f5f8")]))
    if extra:
        st += extra
    t.setStyle(TableStyle(st))
    return t


def precisa_corrigir(txt):
    t = txt.lower()
    return "<b>não</b>" in t or "<b>não " in t or "não bate" in t


doc = BaseDocTemplate(OUT, pagesize=A4, leftMargin=1.6 * cm, rightMargin=1.6 * cm, topMargin=2.0 * cm, bottomMargin=2.0 * cm,
                      title=f"Relatório de análise de habitualidade - {CAC}", author="Análise assistida (skill auditoria-habitualidade-cac)")
doc.addPageTemplates([PageTemplate(id="p", frames=[Frame(1.6 * cm, 2.0 * cm, 17.8 * cm, 25.6 * cm, id="f", leftPadding=0, rightPadding=0, topPadding=0, bottomPadding=0)])])
S = []

S.append(P("Relatório de análise de habitualidade", h1))
ident = [[P("<b>CAC</b>", cell), P(CAC, cell), P("<b>CR</b>", cell), P(D["cr"], cell)],
         [P("<b>Entidade</b>", cell), P(D["entidade"], cell), P("<b>Padrão</b>", cell), P(D["padrao"], cell)],
         [P("<b>Declaração</b>", cell), P(D["declaracao"], cell), P("<b>Exigência</b>", cell), P(D["exigencia"], cell)],
         [P("<b>Filiação</b>", cell), P(D["filiacao"], cell), P("<b>Situação</b>", cell), P(D["situacao"], cell)]]
S += [tbl(ident, [2.2, 6.2, 2.2, 7.2], header=False, extra=[("BACKGROUND", (0, 0), (0, -1), CINZA), ("BACKGROUND", (2, 0), (2, -1), CINZA)]), Spacer(1, 6)]
S.append(P(D["documentos"], small))
S.append(Spacer(1, 4))
S.append(P(f'<font color="{VERM}"><b>Legenda:</b> o que aparece em vermelho, com a palavra CORRIGIR, precisa ser corrigido antes de a declaração ser usada.</font>', small))

S.append(P("1. Conclusão", h2))
S.append(tbl([[P(D["conclusao"], cell)]], [17.8], header=False,
             extra=[("BOX", (0, 0), (-1, -1), 1.1, INK), ("BACKGROUND", (0, 0), (-1, -1), CINZA), ("TOPPADDING", (0, 0), (-1, -1), 6), ("BOTTOMPADDING", (0, 0), (-1, -1), 6)]))

R = D["resultado"]
S.append(P("2. Resultado por tipo de arma e ciclo", h2))
S.append(P(R.get("legenda", ""), ParagraphStyle("sk2", parent=small, keepWithNext=1, spaceAfter=3)))
rows = [[P(x, hdr9) for x in R["cabecalho"]]]
extra = []
for i, lin in enumerate(R["linhas"], 1):
    out = []
    for j, c in enumerate(lin):
        if j > 0 and precisa_corrigir(c):
            out.append(P(f'<font color="{VERM}">{c}</font><br/>{verm("CORRIGIR")}', cell))
            extra.append(("BACKGROUND", (j, i), (j, i), VERM_BG))
        else:
            out.append(P(c, cell))
    rows.append(out)
S.append(tbl(rows, R.get("larguras", [5.6, 4.0, 3.9, 4.3]), zebra=True, extra=extra))
if R.get("nota"):
    S += [Spacer(1, 3), P(R["nota"], small)]

S.append(P("3. Ações para o processamento da declaração", h2))
S.append(P("Corrija um lançamento somente se a folha assinada confirmar a arma realmente usada naquele dia, e anote o motivo da correção. Não ajuste dados apenas para atingir o mínimo.", ParagraphStyle("sk", parent=small, keepWithNext=1)))
ac = [[P("", hdr), P("Prior.", hdr), P("O que a declaração mostra", hdr), P("O que os documentos mostram", hdr), P("Ação", hdr)]]
ex2 = [("ALIGN", (0, 0), (0, -1), "CENTER")]
for i, a in enumerate(D["acoes"], 1):
    corr = a.get("corrigir", True)
    pri = a.get("prioridade", "")
    pri_txt = verm(pri) if (corr and pri.lower() == "alta") else (f"<b>{pri}</b>" if pri.lower() != "baixa" else pri)
    acao = (verm("CORRIGIR: ") + f'<font color="{VERM}">{a["acao"]}</font>') if corr else a["acao"]
    ac.append([P("[   ]", cell), P(pri_txt, cell), P(a["declaracao"], cell), P(a["documentos"], cell), P(acao, cell)])
    if corr:
        ex2.append(("BACKGROUND", (4, i), (4, i), VERM_BG))
S.append(tbl(ac, [0.9, 1.3, 4.9, 5.4, 5.3], extra=ex2))

A = D["armas"]
S.append(P("4. Armas do CAC e documentos (conferência com o cadastro)", h2))
arm = [[P(x, hdr) for x in A["cabecalho"]]]
ex3 = []
for i, lin in enumerate(A["linhas"], 1):
    arm.append([P(c, tiny) for c in lin])
S.append(tbl(arm, A.get("larguras", [4.4, 2.6, 3.6, 3.2, 4.0]), zebra=True, extra=ex3))
if A.get("nota"):
    S += [Spacer(1, 4), P(A["nota"], small)]

S.append(P("5. O que está correto", h2))
S.append(P(D["corretos"], base))
S.append(P("6. Normas, premissas e limitações", h2))
S += [P(D["normas"], small), Spacer(1, 3), P(D["premissas"], small), Spacer(1, 3), P(D["limitacoes"], small)]

S += [PageBreak(), P("Anexo. Dia a dia: declaração x folha de assinatura", h2)]
S += [P(D.get("nota_dia_a_dia", ""), small), Spacer(1, 3)]
dd = [[P("Data", hdr), P("Ciclo", hdr), P("Calibres na declaração", hdr), P("Folha", hdr), P("Situação", hdr)]]
ex4 = []
for i, x in enumerate(D["dia_a_dia"], 1):
    if x.get("corrigir"):
        sit = verm("CORRIGIR: ") + f'<font color="{VERM}">{x["situacao"]}</font>'
        ex4.append(("BACKGROUND", (0, i), (-1, i), VERM_BG))
    else:
        sit = x["situacao"]
    dd.append([P(x["data"], tiny), P(str(x["ciclo"]), tiny), P(x["calibres"], tiny), P(x["folha"], tiny), P(sit, tiny)])
S.append(tbl(dd, [3.0, 1.0, 5.3, 3.2, 5.3], extra=ex4))
if D.get("rodape_anexo"):
    S += [Spacer(1, 3), P(D["rodape_anexo"], tiny)]
doc.build(S, canvasmaker=NC)
print("OK", OUT)
