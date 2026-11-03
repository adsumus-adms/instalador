# Formato da declaração de habitualidade do sistema do clube

Documento "Comprovação de participações em treinamentos e/ou competições de tiro (habitualidade)", Anexo E (art. 35 do Decreto nº 11.615/2023), assinado digitalmente pela entidade. Extraia o texto com `pdftotext -layout`.

## Estrutura
1. **Entidade declarante**: nome, CNPJ, CR do clube e validade.
2. **Atirador**: nome, CPF, CR (número e validade), endereço, **filiação** (número e **data**).
3. **Resumo da habitualidade**: período e tabela por grupo, com colunas QTD MUNIÇÃO, QTD HABITUALIDADE, regional, estadual, nacional e treino.
4. **Lista de eventos**, dividida em blocos por classificação da arma:
   - "Calibre de uso restrito" (arma representativa do inciso III, art. 12);
   - "Calibre de uso permitido";
   - **"Calibre de uso Indeterminado"**.

Cada linha traz: ordem, data-hora, **Sigma** da arma, calibre, quantidade de munição, tipo de evento.

## Rótulos de grupo da declaração × os 6 grupos da skill (correspondência presumida, confirmar com o usuário)
| Declaração | Skill |
|---|---|
| 11.1 permitida de porte | 1 |
| 12.3 restrita de porte | 2 |
| 12.4 restrita, longa, raiada | 3 |
| 11.2 permitida, longa, raiada, repetição / 11.4 permitida, longa, raiada, 22LR | 4 |
| 11.3 permitida, longa, lisa, repetição | 5 |
| 12.5 restrita, longa, lisa, semiauto | 6 |

## Pontos que já deram problema (conferir sempre)
- **Bloco "Indeterminado" não entra no resumo**: os treinos listados nele aparecem na lista, mas a coluna de habitualidade do grupo fica 0. Indica arma (Sigma) sem classificação no sistema. Conte esses treinos como **não habituais na declaração** até o cadastro da arma ser corrigido, e aponte o Sigma.
- **Sigma diferente entre períodos**: confirme se é a mesma arma recadastrada ou armas distintas.
- **Data de filiação posterior a treinos**: treinos anteriores à data de filiação precisam de explicação (renovação de filiação ou lançamento indevido).
- **Horário 00:00**: indica lançamento retroativo/importado, normalmente sem folha de assinatura correspondente.
- **Período do resumo** começa na data do CR e não coincide com os ciclos; recalcule os ciclos com `scripts/ciclos.py`.
- **Mesmo dia, dois calibres/armas** na folha: a declaração pode trazer só um. Confirme se é um treino ou dois.
- Cabeçalho da folha com **CR e filiação em branco** (modelos antigos): registre.
- Horário ou quantidade que difere por pouco entre folha e declaração: se a foto estiver ambígua, marque "leitura incerta".

## Campos e defeitos vistos em declarações mais novas
- Bloco **"Registros da Habitualidade"**: para cada evento traz o sistema de origem (ex.: Tiro Digital), o número do registro e a **data do lançamento**. Compare a data do lançamento com a data do evento: lançamentos feitos muito depois (meses ou mais de um ano) devem ir para as pendências, e a folha assinada passa a ser a prova principal.
- Campo de validade do CR pode vir sem preencher, com o texto cru do modelo (`{pessoa.documento.crValidade.date}`). Aponte como defeito da declaração.
- O nome na declaração pode divergir do CR (letra a menos ou a mais). Compare sempre com o CR e com documentos oficiais.
- O mesmo Sigma pode aparecer em CACs diferentes (arma do clube ou cadastro genérico). Aponte para conferência.
- Os ciclos ALFA são os da Polícia Federal (27/12 a 26/12), confirmados pelo usuário.

## Contagem: linhas × dias distintos
- O resumo da declaração conta **linhas** (cada arma e cada lançamento é uma linha), e uma única ida ao clube pode gerar dezenas de linhas (várias armas, vários lançamentos no mesmo minuto). A regra da PF fala em **eventos distintos**: conte **dias distintos** por grupo e por ciclo, e mostre também o número de linhas.
- Para declarações grandes (centenas de linhas), extraia com `pdftotext -layout` e processe com um script (agrupe por bloco, Sigma, data e ciclo) em vez de contar à mão.
- **Todos os treinos do ciclo antes da data de filiação** da declaração: aponte como risco (pode haver filiação anterior ou transferência).
- **Mesma arma (mesmo Sigma) em dois blocos** (classificada e "Indeterminado"): aponte a inconsistência e mostre a contagem com e sem a correção.
- **Várias armas no mesmo dia em poucos minutos** ou **muitas linhas com o mesmo horário**: pode indicar lançamento em lote; conferir com a folha.

## Declarações mais novas: blocos por inciso
- Os blocos passaram a ser separados por **tipo de arma (inciso e artigo)**, não só por "restrito/permitido": art. 11, inciso I (curta permitida, 11.1), III (longa lisa repetição, 11.3), IV (.22LR, 11.4) e art. 12, incisos III (curta restrita, 12.3), IV (longa raiada restrita, 12.4) e V (lisa semiauto restrita, 12.5). Leia o cabeçalho "Arma representativa do tipo previsto no inciso X, art. NN" de cada bloco para classificar. Um parser que só olha "permitido/restrito" erra o grupo.
- **Armas que não constam nos CRAFs do CAC** (Sigma novo, calibre ou tipo que ele não possui) aparecendo em dias específicos indicam lançamento com **arma do clube** ou erro de Sigma. Compare com a folha: se a folha traz calibres diferentes dos declarados naquele dia, aponte como divergência grave e peça para esclarecer o que de fato aconteceu antes de reemitir. Não proponha ajustar o lançamento só para atingir o mínimo.
- Uma declaração reemitida pode ter corrigido vários pontos e piorado outros. Compare sempre com a anterior (linhas por dia, Sigmas, blocos) antes de concluir.
