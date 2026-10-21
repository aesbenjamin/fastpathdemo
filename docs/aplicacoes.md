# Aplicações do FastPath fora da música

A demo usa três ideias que valem para qualquer domínio com eventos no tempo:

| Na demo | No mundo real |
|---|---|
| `Performance` (a pessoa que tocou) | Nó base: cliente, conta, paciente, máquina, caso de processo, assinante |
| `NoteEvent {noteCode}` | Evento com propriedade categórica: tipo de compra, transação, diagnóstico, alarme, atividade |
| `t` (ms desde o início) | Timestamp do evento |
| `obsTime` | Momento da observação: "hoje" ou a data de corte da previsão |
| Tribo | Segmento comportamental |
| Alma gêmea musical | Vizinho mais próximo: cliente parecido, caso de fraude parecido, paciente com a mesma trajetória |

O que o FastPath acrescenta a um modelo de sequência comum é o **tempo entre eventos**. Três logins falhos em 5 segundos e três logins falhos em um mês têm a mesma sequência, mas vetores diferentes. Na demo, a tribo *Silêncio e Explosão* mostra isso: ela só existe no modo "notas + tempo".

Os embeddings servem para:

- **Similaridade:** KNN, "quem se parece com este caso?"
- **Segmentação:** clustering das jornadas
- **Previsão:** features para um classificador (churn, fraude, falha, readmissão)

## Casos de uso e datasets públicos

### Jornada do cliente e e-commerce

| Dataset | Nó base | Eventos | Pergunta |
|---|---|---|---|
| [Olist Brazilian E-Commerce](https://www.kaggle.com/datasets/olistbr/brazilian-ecommerce) | Cliente | Pedido, pagamento, entrega, avaliação | Quais jornadas de compra terminam em avaliação ruim? |
| [REES46 eCommerce Behavior](https://www.kaggle.com/datasets/mkechinov/ecommerce-behavior-data-from-multi-category-store) | Sessão ou usuário | `view`, `cart`, `remove_from_cart`, `purchase` | Quais sessões se parecem com as que convertem? |
| [Retailrocket](https://www.kaggle.com/datasets/retailrocket/ecommerce-dataset) | Visitante | `view`, `addtocart`, `transaction` | Recomendação por usuários com o mesmo ritmo de navegação |
| [Online Retail II (UCI)](https://archive.ics.uci.edu/dataset/502/online+retail+ii) | Cliente | Compra por categoria de produto | Segmentação RFM baseada em sequência |
| [Instacart Market Basket](https://www.kaggle.com/datasets/psparks/instacart-market-basket-analysis) | Usuário | Pedido por corredor/departamento, com `days_since_prior_order` | Prever a próxima recompra |

### Fraude e risco

| Dataset | Nó base | Eventos | Pergunta |
|---|---|---|---|
| [PaySim](https://www.kaggle.com/datasets/ealaxi/paysim1) | Conta | `CASH_IN`, `CASH_OUT`, `TRANSFER`, `PAYMENT`, `DEBIT` por hora (`step`) | Contas com o mesmo padrão "transferência seguida de saque" das fraudes conhecidas |
| [IBM Credit Card Transactions](https://www.kaggle.com/datasets/ealtman2019/credit-card-transactions) | Cartão | MCC, tipo de transação, erros | Mudança brusca de ritmo de uso antes da fraude |

### Saúde

| Dataset | Nó base | Eventos | Pergunta |
|---|---|---|---|
| [Synthea](https://synthea.mitre.org/downloads) (sintético) | Paciente | Consultas, condições, procedimentos, medicações | Coortes de pacientes com a mesma trajetória clínica |
| [MIMIC-IV Clinical Database Demo](https://physionet.org/content/mimic-iv-demo/) | Internação | Exames, prescrições, transferências entre unidades | Pacientes parecidos para apoiar o próximo passo de cuidado |

### Manutenção preditiva

| Dataset | Nó base | Eventos | Pergunta |
|---|---|---|---|
| [NASA C-MAPSS Turbofan](https://www.kaggle.com/datasets/behrad3d/nasa-cmaps) | Motor | Leituras de sensores discretizadas em faixas (ex.: "temperatura alta") | Motores com a mesma escalada de sinais antes da falha |

### Processos e operações (process mining)

| Dataset | Nó base | Eventos | Pergunta |
|---|---|---|---|
| [BPI Challenge 2017](https://data.4tu.nl/articles/dataset/BPI_Challenge_2017/12696884) | Pedido de crédito | Atividades do processo (`A_Create`, `O_Offer`, `W_Validate`…) | Casos com o mesmo caminho e o mesmo tempo entre etapas; quais terminam cancelados? |

### Conteúdo e streaming

| Dataset | Nó base | Eventos | Pergunta |
|---|---|---|---|
| [KKBox Churn Prediction](https://www.kaggle.com/c/kkbox-churn-prediction-challenge) | Assinante | Transações de assinatura e logs diários de escuta | Assinantes com o padrão de uso de quem cancelou |
| [Last.fm 1K](http://ocelma.net/MusicRecommendationDataset/lastfm-1K.html) | Usuário | Scrobbles por artista/gênero | Usuários que escutam na mesma ordem e no mesmo ritmo |

### Atendimento e conversas

Conversas de atendimento seguem o mesmo padrão: cada conversa é o nó base e cada mensagem ou intenção é um evento. Assim dá para encontrar conversas com o mesmo fluxo e o mesmo ritmo, e prever quais terminam em escalonamento ou cancelamento.

## Como adaptar a demo a um desses datasets

1. Escolha o nó base e a data de observação (`obsTime`). Para previsão, use a data de corte, para não vazar o futuro.
2. Converta os eventos em uma propriedade categórica inteira (`noteCode` na demo) e o tempo em um número (`t`, em ms, dias ou horas).
3. Encadeie os eventos com `FIRST_EVENT` e `NEXT_EVENT`. O Cypher de projeção em `server/app/fastpath_aga.py` funciona sem alterações.
4. Ajuste `num_time_anchors` e `lookback_horizon` para a escala do domínio. Exemplo: 12 âncoras mensais para um ano de compras.
5. Use os embeddings em KNN (similaridade), KMeans (segmentos) ou como features de um classificador.
