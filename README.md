# FastPath Music

Demo interativa do **FastPath** (Neo4j Graph Data Science, Aura Graph Analytics). A plateia escaneia um QR code, toca uma melodia num piano colorido no celular, e cada tecla vira um evento no grafo:

```
(:Performance)-[:FIRST_EVENT]->(:NoteEvent {t, noteCode})-[:NEXT_EVENT]->(:NoteEvent)-[:NEXT_EVENT]->...
```

O FastPath transforma cada sequência de eventos no tempo em um embedding. Com ele a demo encontra quem tocou parecido (cosseno + euclidiana), agrupa a plateia em tribos e desenha uma galáxia de melodias. Uma camada de IA generativa narra os resultados: perfis, nomes de tribos, explicação de pares, composição de um "hino" por tribo e perguntas em linguagem natural respondidas com Cypher.

- **O FastPath é IA?** Sim: é aprendizado de máquina não supervisionado (graph embeddings). A IA generativa vem por cima e só narra fatos calculados, nunca inventa similaridade.
- **Aplicações reais e datasets públicos:** [docs/aplicacoes.md](docs/aplicacoes.md)

## Arquitetura

| Peça | Onde roda | O que faz |
|---|---|---|
| `web/` (React + Vite) | GitHub Pages | Celular: grava as notas direto no AuraDB via WebSocket seguro. Palco (`#/palco`): os 7 atos da apresentação |
| `server/` (FastAPI) | Notebook do apresentador | Sessão Aura Graph Analytics, FastPath, KNN, tribos, layout e LLM |
| AuraDB | Neo4j Aura | Fonte única: melodias, embeddings, tribos, `SIMILAR_TO` |

O FastPath roda numa sessão do **Aura Graph Analytics** (`gds.fast_path.mutate`, preview). Sem chaves de API, ou se a sessão falhar, o servidor usa uma reimplementação local em NumPy (`FASTPATH_FALLBACK_LOCAL=true`) e o palco mostra o selo "FastPath local (simulado)".

## Setup

### 1. Aura

1. AuraDB já provisionado (instância `FastPath`). As credenciais ficam em `credentials.txt`, que está no `.gitignore`.
2. **Aura Graph Analytics:** no Aura Console, habilite Graph Analytics no projeto e crie uma API key em *Account > API keys*. Anote client id, client secret e project id.
3. O FastPath é feature em preview: confirme que está liberado para a sua organização/projeto.

### 2. Servidor

```bash
cd server
uv venv --python 3.12 && uv pip install -e .    # ou: python3.12 -m venv .venv && .venv/bin/pip install -e .
cp .env.example .env                              # preencha Aura, AGA e (opcional) OpenAI
.venv/bin/uvicorn app.main:app --port 8000
```

Para usar o AGA, troque `FASTPATH_BACKEND=aga` e preencha `AURA_CLIENT_ID`, `AURA_CLIENT_SECRET` e `AURA_PROJECT_ID`. O project id é obrigatório quando a conta tem vários projetos. Para conferir tudo antes do evento (sessão, projeção, FastPath e KNN), rode:

```bash
server/.venv/bin/python scripts/check_aga.py
```

Tempos medidos com 38 melodias: cerca de 55 s para abrir a sessão, mais cerca de 40 s por rodada do pipeline (as duas chamadas do FastPath rodam em paralelo, cerca de 22 s). Sem `OPENAI_API_KEY` a demo funciona com textos de reserva baseados em regras.

Popular os "ecos" (36 bots em 6 arquétipos, para a galáxia não começar vazia):

```bash
server/.venv/bin/python scripts/seed.py --per-archetype 6
```

### 3. Site

```bash
cd web
cp .env.example .env.local     # mesma URI/usuário/senha do Aura
npm install && npm run dev     # http://127.0.0.1:5173  |  palco: http://127.0.0.1:5173/#/palco
```

### 4. GitHub Pages

1. Crie o repositório e faça push na `main`.
2. Em *Settings > Pages*, escolha **GitHub Actions** como fonte.
3. Em *Settings > Secrets and variables > Actions*, crie os secrets `VITE_NEO4J_URI`, `VITE_NEO4J_USER` e `VITE_NEO4J_PASSWORD`.
4. O workflow `.github/workflows/deploy.yml` publica `web/dist` a cada push.

O palco pode rodar direto do Pages, falando com a API local: `https://<usuario>.github.io/<repo>/?api=http://localhost:8000#/palco`. O Chrome permite chamar `localhost` a partir de uma página https. Se preferir rodar o palco em `localhost`, defina `VITE_PUBLIC_URL` com a URL do Pages para o QR code apontar para o lugar certo.

> A senha do Aura vai embutida no JavaScript público. É aceitável para uma demo descartável; apague ou troque a senha da instância depois do evento.

## Roteiro da apresentação (~15 min)

Atalhos do palco: `←` `→` ou `1`–`7` trocam de ato, `m` alterna o modo "notas + tempo" / "só notas", `l` alterna o idioma, `f` entra em tela cheia, e a engrenagem no canto abre os controles (aquecer sessão AGA, criar ecos robôs, limpar pessoas, encerrar sessão).

**Idioma (PT / EN):** o botão PT/EN no topo do palco e no celular troca toda a interface. O QR do Lobby leva o idioma atual do palco (`?lang=en`), então quem escaneia já abre no mesmo idioma, e cada pessoa ainda pode trocar no próprio celular. Os textos da IA (nomes e descrições das tribos, perfis, composições) são gerados nos dois idiomas a cada rodada do FastPath; a explicação do Duelo e as respostas do Pergunte são geradas no idioma escolhido. Resultados de rodadas anteriores a essa versão aparecem em português até o FastPath rodar de novo.

**Antes de começar:** abra o palco e clique em *Aquecer sessão AGA* na engrenagem. A sessão leva alguns minutos para subir na primeira vez e cerca de 1 minuto para conectar depois. **Depois do evento:** clique em *Encerrar sessão AGA*, porque a sessão é cobrada enquanto existir.

| Ato | Tempo | O que fazer | O que dizer |
|---|---|---|---|
| 1. Lobby | 3 min | QR code na tela; o contador sobe ao vivo | "Toquem o que quiserem por até 20 segundos. Cada tecla vira um nó no grafo." |
| 2. Algoritmo | 2 min | Clique em **Rodar FastPath** e acompanhe as etapas | Sequência, depois vetor, depois tribo. O FastPath olha *quais* eventos e *quando* aconteceram. Cosseno compara o padrão; euclidiana, a intensidade. |
| 3. Galáxia | 3 min | Clique nos pontos para tocar; aperte `m` | Pontos próximos tocaram parecido. Em "só notas", a tribo *Silêncio e Explosão* se desfaz: sem o tempo, ela some. Esse é o valor do FastPath. |
| 4. Duelo | 2 min | Escolha duas pessoas e toque **Juntos** | Mostre o score e o texto da IA explicando *por que* são parecidos, sempre a partir dos números. |
| 5. Compor | 2 min | Escolha uma tribo e clique em **Compor para…** | A IA compõe uma melodia no estilo da tribo; o FastPath a coloca na galáxia e confirma se ela caiu na tribo certa. |
| 6. Pergunte | 2 min | Use as sugestões ou digite | A IA escolhe uma consulta Cypher de um catálogo fixo, o Neo4j responde e a IA narra. Mostre o Cypher na tela. |
| 7. Aplicações | 1 min | | Troque a nota pelo seu evento: jornada do cliente, fraude, saúde, manutenção, processos, streaming. |

Os celulares recebem o resultado sozinhos (tribo, perfil e alma gêmea musical) assim que o FastPath termina.

## Parâmetros do FastPath

Ajustados com `scripts/tune.py` sobre os 6 arquétipos de bots e confirmados no AGA. Com o FastPath real, o modo "notas + tempo" chega a ARI 0.59 contra 0.46 do "só notas", e o vizinho mais próximo é do mesmo arquétipo em 81% dos casos, contra 72%.

| Parâmetro | Valor | Por quê |
|---|---|---|
| `embedding_dimension` | 64 | Suficiente para ~100 melodias |
| `num_time_anchors` | 20 (modo "só notas": 1) | Uma âncora por segundo da gravação de 20 s |
| `lookback_horizon` / `obsTime` | 20001 ms | Melodias alinhadas pelo início |
| `smoothing_window` / `smoothing_rate` | 1 / 1÷espaçamento | Um evento "vaza" para a âncora vizinha |
| `decay_rate` | 0 | Começo e fim da melodia pesam igual |

### Veredito do Duelo

O score de um par é `0.6·cosseno + 0.4·euclidiana` (0 a 1). O Duelo classifica o par por cortes calibrados na saída do KNN da rodada atual, por modo, e a IA é obrigada a concordar com o veredito e a adotar um tom condizente (sóbrio para "parecidas", enfatizando diferenças para "levemente"):

| Veredito | Corte |
|---|---|
| muito parecidas | ≥ mediana do score do *melhor* vizinho de cada melodia (~0.77 no modo notas + tempo) |
| parecidas | ≥ mediana do score entre todos os pares vizinhos do KNN (~0.68) |
| levemente parecidas | ≥ corte de "parecidas" − 0.15 |
| diferentes | abaixo disso |

Ou seja: só é "parecido" quem está no nível dos vizinhos que o FastPath de fato encontrou. Para fixar valores, use `SCORE_VERY_SIMILAR`, `SCORE_SIMILAR`, `SCORE_WEAK` (e `SCORE_WEAK_BAND`) no `server/.env`.

## Estrutura

```
server/app/   main (API), pipeline, fastpath_aga, fastpath_local, analytics, llm, ask (catálogo Cypher), facts, bots, db
scripts/      seed.py, tune.py
web/src/      pages/Participant.tsx, pages/stage/ (atos), components/, lib/ (audio, neo4j, api)
docs/         aplicacoes.md
```
