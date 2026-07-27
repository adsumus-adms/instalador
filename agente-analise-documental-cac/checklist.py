# -*- coding: utf-8 -*-
"""Checklists de documentos e tabela de identificação de tipo de processo.

Baseado na especificação "Agente de IA — Análise Documental de Processos CAC"
(seções 2 e 9).
"""

import unicodedata

# Checklist de documentos exigidos por tipo de processo.
# Para TRANSFERENCIA, os documentos estão divididos por papel (doador/receptor),
# já que cada um envia um conjunto diferente. O GRU (gerado internamente pela
# Adsumus) não entra aqui, pois não é fornecido pelo cliente.
CHECKLISTS = {
    "CR": [
        "Laudo de tiro",
        "Certidão Federal",
        "Declaração de inexistência de inquéritos policiais",
        "CNH",
        "Laudo psicológico",
        "Comprovante de residência (5 anos)",
        "Comprovante de ocupação lícita",
        "Comprovante/declaração de segurança do endereço",
        "Certidão Estadual",
        "Declaração de Segurança do Acervo (DSA) assinada",
        "Declaração de Compromisso de Participação em Treinamentos assinada",
        "Declaração de Filiação a Entidade de Tiro assinada",
        "Certidão da União",
        "Certidão Eleitoral",
    ],
    "AQUISICAO": [
        "Laudo de tiro",
        "Comprovante de habitualidade",
        "Declaração de Segurança do Acervo (DSA) assinada",
        "Certidão Federal",
        "Declaração de inexistência de inquéritos policiais",
        "Documento de identificação pessoal",
        "Laudo psicológico",
        "Comprovante de residência fixa",
        "Comprovante de ocupação lícita",
        "Certidão Estadual",
        "Certidão da União",
        "Certidão Eleitoral",
    ],
    "ENDERECO": [
        "Declaração de Segurança do Acervo (DSA) assinada",
        "Comprovante de residência (novo endereço)",
        "DGA",
        "Documento de identificação pessoal",
    ],
    "CRAF": [
        "Nota fiscal",
        "Autorização de compra",
        "CNH",
    ],
    "TRANSFERENCIA": {
        "doador": [
            "CNH",
            "Comprovante de residência",
            "CRAF da arma",
            "Comprovante de ocupação lícita",
            "Procuração para PF",
        ],
        "receptor": [
            "CNH",
            "CR",
            "Comprovante de residência",
            "Declaração de 5 anos",
            "Declaração de Segurança do Acervo (DSA)",
            "Termo de doação (assinado por ambos)",
            "Requerimento padrão",
            "Comprovante de habitualidade",
            "Declaração de compromisso",
            "Declaração de filiação",
            "Documento de identificação pessoal (IPC)",
            "Certidão Federal",
            "Certidão Estadual",
            "Certidão da União",
            "Certidão Eleitoral",
            "Laudo psicológico",
            "Laudo de tiro",
            "Comprovante de ocupação lícita",
        ],
    },
}

NOMES_TIPO = {
    "CR": "Certificado de Registro (CR)",
    "AQUISICAO": "Aquisição de arma de fogo",
    "ENDERECO": "Mudança de endereço / inclusão de segundo endereço",
    "CRAF": "CRAF",
    "TRANSFERENCIA": "Transferência de arma",
}

# Tabela de "de-para" — variações de título de cartão já observadas (seção 9),
# usada tanto para o nome de cartão do Trello quanto para o nome da pasta local.
_VARIACOES = {
    "CERTIFICADO DE REGISTRO": "CR",
    "CERIFICADO DE REGISTRO": "CR",
    "RENOVACAO CR": "CR",
    "CR": "CR",
    "AUTORIZACAO DE COMPRA": "AQUISICAO",
    "AQUISICAO DE ARMA": "AQUISICAO",
    "AQUISICAO DE ARMA DE FOGO": "AQUISICAO",
    "CRAF": "CRAF",
    "RENOVACAO CRAF": "CRAF",
    "TRANSFERENCIA": "TRANSFERENCIA",
    "TRANSFERENCIA DE ARMA": "TRANSFERENCIA",
    "SEGUNDO ENDERECO": "ENDERECO",
    "MUDANCA DE ENDERECO": "ENDERECO",
    "INCLUSAO DE SEGUNDO ENDERECO": "ENDERECO",
}


def _normalizar(texto):
    """Maiúsculas, sem acento, espaços simples — para comparação tolerante."""
    texto = unicodedata.normalize("NFKD", texto)
    texto = "".join(c for c in texto if not unicodedata.combining(c))
    return " ".join(texto.upper().split())


def identificar_tipo_processo(texto):
    """Tenta mapear um texto livre (nome de pasta ou título de cartão) para um
    dos tipos de processo em CHECKLISTS, usando a tabela de-para da seção 9.

    Retorna a chave do tipo (ex: "CR") ou None se não for possível identificar
    com confiança — nesse caso o chamador deve pedir confirmação ao usuário,
    nunca adivinhar (regra da seção 9).
    """
    texto_norm = _normalizar(texto)

    # Modelo específico da arma pode vir junto no texto (ex: "AUTORIZAÇÃO DE
    # COMPRA GX4") — verifica por trecho contido, da variação mais longa para
    # a mais curta, para evitar que um trecho curto capture errado.
    for variacao in sorted(_VARIACOES, key=len, reverse=True):
        if variacao in texto_norm:
            return _VARIACOES[variacao]

    return None


def obter_checklist(tipo, papel=None):
    """Retorna a lista de documentos exigidos para o tipo de processo.

    Para TRANSFERENCIA é obrigatório informar `papel` ("doador" ou "receptor").
    """
    checklist = CHECKLISTS.get(tipo)
    if checklist is None:
        raise ValueError(f"Tipo de processo desconhecido: {tipo!r}")
    if tipo == "TRANSFERENCIA":
        if papel not in ("doador", "receptor"):
            raise ValueError(
                "Para TRANSFERENCIA é preciso informar papel='doador' ou papel='receptor'"
            )
        return checklist[papel]
    return checklist
