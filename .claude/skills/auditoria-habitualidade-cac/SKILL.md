---
name: auditoria-habitualidade-cac
description: Audita a habitualidade de um CAC (Colecionador, Atirador Desportivo ou Caçador) cruzando os registros lançados no sistema do clube, as folhas de assinatura (PDF/foto escaneada) e a declaração de habitualidade emitida pelo sistema. Classifica as armas nos 6 grupos de habitualidade, define os ciclos conforme a data de emissão do CR (padrão ALFA ou BRAVO) e aponta divergências dia a dia. Use sempre que o usuário pedir para conferir, auditar, validar ou analisar habitualidade, declaração de habitualidade, folhas de assinatura, presenças/treinos/frequência de um CAC, ou comparar o que está lançado no sistema com o que foi assinado, mesmo que não use a palavra "auditoria".
---

# Auditoria de habitualidade de CAC

Objetivo: dizer, com evidências, se a **declaração de habitualidade** emitida pelo sistema do clube reflete os dias em que o CAC realmente compareceu. A fonte da verdade é a **folha de assinatura** (assinatura do próprio CAC); o **sistema** é o que foi lançado; a **declaração** é o que será apresentado ao Exército. Divergência entre os três pode invalidar a habitualidade, por isso o relatório deve ser preciso e rastreável, sem presumir nada que o documento não mostre.

## Entradas

1. **Registros do sistema** do CAC (lançamentos de presença/treino): normalmente tabela ou dados colados/consultados no sistema.
2. **Folhas de assinatura**: PDF ou foto escaneada. Podem ter assinatura manuscrita e data escrita à mão.
3. **Declaração de habitualidade** emitida pelo sistema (PDF).
4. **Dados informados pelo usuário** quando não estiverem no sistema: data de emissão do CR e armas do CAC (modelo, calibre, tipo). Se faltarem e não constarem em nenhum documento, pergunte antes de analisar. Não estime.

Para PDFs e imagens, use a skill `pdf` e leia as imagens visualmente. Em folhas escaneadas, transcreva cada linha (data, nome, assinatura presente sim/não, atividade, arma se houver) numa tabela intermediária e **marque o que estiver ilegível** como "ilegível" em vez de adivinhar.

## Passo 1: Classificar as armas em grupos

Leia `references/grupos-armas.md`. Para cada arma do CAC (modelo, calibre, tipo, ação), atribua um dos 6 grupos:

1. Armas curtas de uso permitido
2. Armas curtas de uso restrito
3. Armas longas raiadas de uso restrito
4. Armas longas raiadas de uso permitido
5. Armas longas de alma lisa de repetição
6. Armas longas de alma lisa semiautomáticas

Se a classificação depender de dado que falta (calibre, energia, ação), liste como **pendência** e peça ao usuário. Uma classificação errada muda a exigência da habitualidade, então não chute.

## Passo 2: Definir os ciclos

Rode o script (ele evita erro de cálculo de datas):

```bash
python3 scripts/ciclos.py --cr-emissao AAAA-MM-DD --declaracao AAAA-MM-DD
```

Regras (informadas pelo usuário):
- **CR emitido antes de 01/01/2023, padrão ALFA**: primeiro ciclo de **23/12/2022 a 22/12/2024**. Ciclos seguintes: de 12 em 12 meses a partir de 23/12/2024 (premissa, confirme com o usuário se o caso chegar a esse ponto).
- **CR emitido em 01/01/2023 ou depois, padrão BRAVO**: ciclos de **12 em 12 meses a partir da data de emissão do CR**, até a data em que a declaração será emitida (o último ciclo pode estar em aberto/parcial; sinalize).

Se a data de emissão do CR não estiver no sistema, o usuário informará no pedido. Sem ela, pergunte.

## Passo 3: Cruzar os três conjuntos

Para cada ciclo e cada data, monte a matriz **Sistema × Folha × Declaração** e classifique:

| Situação | Significado |
|---|---|
| OK | Presente nos três |
| Sem assinatura | Lançado no sistema/declaração, mas sem folha ou sem assinatura do CAC |
| Não lançado | Assinado na folha, ausente do sistema/declaração (prejuízo ao CAC) |
| Data divergente | Mesma ocorrência com data diferente entre fontes |
| Fora do ciclo | Data fora do ciclo ao qual foi atribuída |
| Dia duplicado | Mais de um lançamento no mesmo dia (verifique se a regra do grupo conta 1 por dia) |
| Ilegível | Não foi possível confirmar na imagem |

Confira também: arma/grupo informados no lançamento versus o grupo da arma (passo 1), nome/CR do CAC em cada folha, e se a quantidade de dias por ciclo informada na declaração bate com a contagem real.

## Passo 4: Avaliar a exigência por grupo e ciclo

Leia `references/exigencias.md`. Regra atual: cada ciclo precisa de 8 treinamentos registrados. Para cada ciclo, informe quantos treinos estão confirmados nos três documentos, se cumpre os 8 e, no ciclo em aberto, quantos faltam. Não invente exigências além das que estão no arquivo.

## Saída: relatório de divergências

Salve em arquivo (Markdown; gere `.xlsx` com a skill `xlsx` se o usuário preferir planilha) e resuma no chat. Estrutura:

1. **Identificação**: CAC, CR, data de emissão, padrão (ALFA/BRAVO), data da declaração.
2. **Armas e grupos**: tabela arma → grupo (com pendências).
3. **Ciclos**: lista com início e fim.
4. **Resumo por ciclo**: dias no sistema, dias nas folhas, dias na declaração, e divergências.
5. **Tabela detalhada** dia a dia (Sistema × Folha × Declaração × Situação).
6. **Conclusão**: a declaração está de acordo ou não, citando os dias que causam a diferença.
7. **Pendências e limitações**: itens ilegíveis, dados faltantes, premissas adotadas.

Seja objetivo e cite sempre a fonte (arquivo e página) de cada achado, para que a conferência humana seja rápida. Este relatório é apoio à conferência; a responsabilidade pela declaração continua com o clube e o CAC.
