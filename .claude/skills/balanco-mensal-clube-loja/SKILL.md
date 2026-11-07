---
name: balanco-mensal-clube-loja
description: Faz o balanço mensal da Adsumus, clube (adsumus.clube.tiro.digital) e loja (adsumus.loja.tiro.digital). Levanta munições vendidas por calibre, ticket médio do clube, quantidade de armas vendidas na loja, margem de lucro média e aponta onde melhorar (calibres de margem baixa, vendas abaixo do custo, queda de volume, concentração). Entrega um documento docx/PDF. Use sempre que o usuário pedir balanço mensal, fechamento do mês, resultado do mês, relatório de vendas, margem, "como foi o mês" do clube ou da loja, munições vendidas por calibre ou ticket médio, mesmo sem dizer "balanço".
---

# Balanço mensal: clube e loja

Objetivo: dar ao dono um retrato fiel do mês do clube e da loja e dizer, com números, onde melhorar. A confiança no relatório depende de ele só afirmar o que veio dos sistemas; o que faltar (custo, calibre) deve aparecer como pendência, nunca como estimativa.

## O que entregar

**Clube**: munições vendidas por calibre; ticket médio; margem média; pontos de melhoria.
**Loja**: munições vendidas por calibre; quantidade de armas vendidas (e por calibre/modelo); margem média; pontos de melhoria.
Cada um com comparação ao mês anterior quando houver dado.

## Passo 1: Definir o período

Padrão: o mês fechado anterior à data de hoje (se hoje é 07/11, o balanço é de outubro). Se o usuário disser outro mês ou "parcial até hoje", use esse e avise no relatório que é parcial. Para a comparação, busque também o mês anterior.

## Passo 2: Extrair os dados dos sistemas

Leia `references/fontes-dados.md`: lá estão os endereços, o caminho de cada relatório e as pegadinhas já descobertas. Os dois sistemas exigem login do usuário; use o navegador (skills `built-in-browser` ou `chrome-browser`, a que estiver disponível) já autenticado. **Nunca peça nem digite senha**; se cair na tela de login, peça ao usuário que entre e continue.

Se o arquivo de fontes ainda tiver trechos "A DESCOBRIR", é a primeira execução: explore os menus de vendas/relatórios/financeiro de cada sistema, escolha o relatório que traz itens vendidos com calibre, quantidade, valor e custo, e **registre o caminho em `references/fontes-dados.md`** (sem dados de clientes) para as próximas vezes. Prefira exportar o relatório (csv/xlsx) a copiar de tela.

Se algum sistema não expuser o custo, procure custo médio na ficha do produto/estoque. Se ainda assim não houver, pergunte ao usuário antes de seguir; margem sem custo real não serve.

## Passo 3: Normalizar para o CSV padrão

Gere um CSV por unidade com as colunas que `scripts/consolidar.py` descreve no cabeçalho: `unidade, data, venda_id, cliente_id, categoria, calibre, descricao, qtd, receita, custo`.

- `categoria`: `municao`, `arma` ou `outro` (acessórios, serviços, mensalidades, aluguel de arma etc. ficam em `outro`; só `municao` e `arma` entram nas contagens pedidas, mas `outro` conta na receita e margem totais).
- `qtd` de munição: use sempre a mesma unidade em todo o relatório. Se o sistema vende em caixas, converta para cartuchos pela quantidade por caixa do cadastro e informe as duas coisas; se não souber a quantidade por caixa, reporte em caixas e diga isso.
- `receita` é o valor líquido da linha (com desconto). `custo` é o total da linha; deixe vazio quando o sistema não informar.
- Devoluções e vendas canceladas: descarte as canceladas e lance devoluções como valores negativos, para não inflar o mês.
- Salve os CSVs **fora do repositório** (pasta temporária da sessão). Eles têm vendas por cliente e o `CLAUDE.md` do projeto proíbe gravar dados de clientes em arquivos do repositório.

## Passo 4: Calcular

```bash
python3 scripts/consolidar.py clube_mes.csv loja_mes.csv --anterior clube_ant.csv loja_ant.csv --saida resumo.json
```

O script normaliza calibres (".380", "380 ACP", "9mm curto" viram ".380 ACP"), separa clube e loja, e entrega: munição por calibre (quantidade, receita, lucro, margem), número de vendas, **ticket médio por venda** e por cliente, armas vendidas, margem média, vendas abaixo do custo, itens sem custo e calibres que não reconheceu.

Duas margens, sempre rotuladas: **ponderada** (lucro total ÷ receita, a que representa o dinheiro de fato) e **simples** (média das margens por item, que mostra se muitos itens pequenos são ruins). Calcule o ticket médio como receita ÷ número de vendas e escreva essa definição no relatório. Se o usuário quiser outra (por exemplo por sócio ou só mensalidade), adapte.

Confira os resultados antes de escrever: calibres listados em `calibres_nao_reconhecidos` precisam ser revistos com o usuário (podem ser erro de digitação no cadastro ou calibre novo); `itens_sem_custo` alto torna a margem pouco confiável, e isso deve estar visível no relatório.

## Passo 5: Apontar onde melhorar

Procure sinais concretos nos dados, cada um com o número que o sustenta. Exemplos do que vale checar:

- calibres de **alto volume e margem baixa** (maior alavanca de lucro: reajustar preço ou renegociar compra);
- **vendas abaixo do custo** e descontos que comeram a margem;
- calibres ou armas com **queda de volume** contra o mês anterior;
- **concentração**: poucos calibres ou poucos clientes respondendo pela maior parte da receita;
- ticket médio do clube abaixo do mês anterior, ou muitas vendas de valor muito baixo (oportunidade de combo, pacote de munição no treino);
- armas vendidas com margem muito menor que a média da loja;
- cadastro ruim: itens sem calibre, sem custo, calibres duplicados.

Priorize 3 a 5 sugestões, da que mais rende para a que menos rende, e diga a estimativa só quando o número vier direto dos dados (por exemplo "subir 5 pontos na margem do 9mm daria R$ X no volume deste mês"). Não invente causas que o dado não mostra; escreva "pode ser" quando for hipótese.

## Passo 6: Montar o documento

Entregue em **docx** (ou PDF se o usuário preferir) usando a skill `docx`. Nome: `balanco-AAAA-MM.docx`, salvo na pasta de saída da sessão, fora do repositório. Estrutura:

1. **Resumo do mês** (5 linhas: receita, margem ponderada, ticket médio do clube, armas vendidas, principal alerta)
2. **Clube**: tabela de munições por calibre (quantidade, receita, margem, variação vs. mês anterior), ticket médio, margem, melhorias
3. **Loja**: tabela de munições por calibre, armas vendidas (quantidade, receita, margem), margem, melhorias
4. **Pontos de melhoria priorizados** (a lista do passo 5, juntando clube e loja)
5. **Qualidade dos dados**: período, itens sem custo, calibres não reconhecidos, pendências

Não coloque nomes ou documentos de clientes no documento; o balanço trabalha com totais. No chat, resuma em poucas linhas, diga onde está o arquivo e liste pendências que dependem do usuário.
