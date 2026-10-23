import { useMemo, useSyncExternalStore } from 'react'

export type Lang = 'pt' | 'en'

const pt = {
  'lang.label': 'idioma',

  'act.0': 'Lobby',
  'act.1': 'Algoritmo',
  'act.2': 'Galáxia',
  'act.3': 'Duelo',
  'act.4': 'Compor',
  'act.5': 'Pergunte',
  'act.6': 'Aplicações',

  'mode.full': 'notas + tempo',
  'mode.notes': 'só notas',

  'common.notes': '{n} notas',
  'common.events': '{n} eventos',
  'common.moreEvents': '+{n} eventos',
  'common.nps': 'notas/s',
  'common.play': 'Tocar',
  'common.ai': 'IA',
  'common.echo': 'eco',
  'common.searchPerson': 'buscar pessoa...',

  'p.title1': 'Toque.',
  'p.title2a': 'Vire',
  'p.title2b': 'grafo',
  'p.title3': 'Ache sua tribo.',
  'p.introA': 'Cada tecla vira um evento no Neo4j. O algoritmo',
  'p.introB': 'transforma a sua sequência no tempo em um vetor e encontra quem tocou parecido com você.',
  'p.nameLabel': 'Como te chamamos?',
  'p.namePlaceholder': 'Seu nome ou apelido',
  'p.enter': 'Entrar no palco',
  'p.playingAs': 'Tocando como',
  'p.recording': 'gravando',
  'p.ready': 'pronto',
  'p.waitingFirst': 'aguardando 1ª nota',
  'p.hint1': 'Toque livremente por até 20 segundos.',
  'p.hint2': 'A gravação começa na primeira tecla.',
  'p.redo': 'Refazer',
  'p.saving': 'Gravando no grafo',
  'p.minNotes': 'Mínimo {n} notas',
  'p.send': 'Enviar melodia',
  'p.waitTitle': 'Sua melodia virou grafo',
  'p.waitTextA': '{n} eventos ligados por',
  'p.waitTextB': 'Agora é com o palco: assim que o FastPath rodar, sua tribo aparece aqui.',
  'p.waitingFastPath': 'aguardando o FastPath',
  'p.tribe': 'tribo',
  'p.statNotes': 'notas',
  'p.statOriginality': 'originalidade',
  'p.soulmate': 'alma gêmea musical',
  'p.botTag': '(eco robô)',
  'p.listenAgain': 'Ouvir de novo',
  'p.playAnother': 'Tocar outra',

  'stage.offlineA': 'Backend fora do ar em',
  'stage.offlineB': 'Rode',
  'stage.offlineC': 'na pasta server.',
  'stage.controls': 'controles',
  'status.fastpathLocal': 'FastPath local',

  'ctrl.title': 'Controles do apresentador',
  'ctrl.session': 'Sessão AGA:',
  'ctrl.warmup': 'Aquecer sessão AGA',
  'ctrl.seed': 'Criar ecos robôs (36)',
  'ctrl.seedShort': 'Criar ecos robôs',
  'ctrl.reload': 'Recarregar dados',
  'ctrl.reloadShort': 'Recarregar',
  'ctrl.clearPeople': 'Limpar pessoas (mantém ecos)',
  'ctrl.clearPeopleShort': 'Limpar pessoas',
  'ctrl.clearAll': 'Limpar tudo',
  'ctrl.endSession': 'Encerrar sessão AGA',
  'ctrl.shortcuts': 'Atalhos: ← → atos · 1-7 · m modo · l idioma · f tela cheia',
  'ctrl.error': 'erro',

  'lobby.scan': 'aponte a câmera',
  'lobby.title1': 'Toque uma melodia.',
  'lobby.title2': 'O grafo escuta.',
  'lobby.people': 'pessoas tocaram',
  'lobby.events': 'eventos no grafo',
  'lobby.bots': 'ecos robôs',

  'pipe.kicker': 'o algoritmo',
  'pipe.titleA': 'Sequência',
  'pipe.titleB': 'vetor',
  'pipe.titleC': 'tribo',
  'pipe.local': 'FastPath local (simulado)',
  'pipe.running': 'FastPath rodando',
  'pipe.again': 'Rodar de novo',
  'pipe.run': 'Rodar FastPath',
  'pipe.p1title': 'Eventos no grafo',
  'pipe.p1sub': 'Cada tecla é um nó ligado ao próximo',
  'pipe.waiting': 'Aguardando melodias...',
  'pipe.sameSeq': 'a mesma sequência no tempo · {n} eventos',
  'pipe.p2sub': 'Notas e tempo viram um embedding',
  'pipe.dims': '{n} dimensões · embedding de {name}',
  'pipe.noVector': 'o vetor aparece depois de rodar o FastPath',
  'pipe.p3title': 'Similaridade',
  'pipe.p3sub': 'Quem tocou parecido fica perto',
  'pipe.cosine': 'Cosseno',
  'pipe.cosineText': 'Mesmo padrão: mesmas notas nos mesmos momentos',
  'pipe.euclidean': 'Euclidiana',
  'pipe.euclideanText': 'Mesma intensidade: quantidade e densidade de notas',
  'pipe.formulaCos': '0.6 · cosseno',
  'pipe.formulaEuc': '0.4 · euclidiana',
  'pipe.formulaTribes': 'tribos = KMeans(embeddings) · nomes =',
  'pipe.done': 'Pronto em {s}s: {total} melodias, {people} {peopleWord}.',
  'pipe.person': 'pessoa',
  'pipe.people': 'pessoas',

  'step.read': 'Lendo as melodias do Neo4j',
  'step.project': 'Projetando o grafo no Aura Graph Analytics',
  'step.fastpath_full': 'FastPath: notas + tempo',
  'step.fastpath_notes': 'FastPath: só notas',
  'step.knn': 'KNN: vizinhos mais próximos',
  'step.rerank': 'Rerank euclidiano, tribos e mapa',
  'step.llm': 'IA generativa: tribos e perfis',
  'step.write': 'Gravando os resultados no grafo',

  'warn.aga_fallback': 'Aura Graph Analytics indisponível ({detail}): usando FastPath local simulado',
  'error.min_melodies': 'São necessárias pelo menos 3 melodias para rodar o FastPath',
  'error.run_first': 'Rode o FastPath antes de compor',
  'error.tribe_not_found': 'Tribo não encontrada',
  'error.performance_not_found': 'Melodia não encontrada',
  'error.neo4j_not_configured': 'Conexão com o Neo4j não configurada',
  'error.send_failed': 'Falha ao enviar',
  'error.compose_failed': 'Falha ao compor',

  'gal.hideBots': 'ocultar ecos',
  'gal.showBots': 'mostrar ecos',
  'gal.searchOpponent': 'buscar adversário...',
  'gal.versus': 'versus',
  'gal.clickOpponent': 'clique no adversário na galáxia',
  'gal.person': 'pessoa',
  'gal.bot': 'eco robô',
  'gal.noTribe': 'sem tribo',
  'gal.picking': 'escolhendo B...',
  'gal.duelWith': 'Duelar com...',
  'gal.mostSimilar': 'mais parecidos',
  'gal.tribesHint': '{n} tribos · clique num ponto',
  'empty.title': 'A galáxia ainda está escura',
  'empty.text': 'Rode o FastPath no ato "Algoritmo" para acender as tribos.',

  'duel.roll': 'piano roll',
  'duel.graph': 'grafo',
  'duel.together': 'Juntos',
  'duel.nvl': 'Neo4j Visualization Library · arraste e dê zoom',
  'duel.cosine': 'cosseno',
  'duel.euclidean': 'euclidiana',
  'duel.score': 'score',
  'duel.genai': 'IA generativa',
  'duel.whySimilar': 'por que são parecidas?',
  'duel.whyNot': 'por que não são parecidas?',
  'duel.verdictOf': 'veredito do FastPath',
  'duel.reading': 'lendo os fatos do grafo...',
  'duel.noExplain': 'Sem explicação disponível.',
  'duel.footnote': 'O modelo recebe apenas os números calculados pelo FastPath e os fatos das melodias.',
  'duel.verdictHeader': 'veredito · cortes calibrados pelo KNN',
  'duel.reference': 'vizinho típico {a} · melhor vizinho {b}',
  'duel.swap': 'trocar {label}: digite um nome',
  'duel.clickToSwap': 'clique para trocar',
  'verdict.very': 'muito parecidas',
  'verdict.similar': 'parecidas',
  'verdict.weak': 'levemente parecidas',
  'verdict.different': 'diferentes',
  'band.very': 'muito',
  'band.similar': 'parecidas',
  'band.weak': 'leve',
  'band.different': 'diferentes',

  'comp.kicker': 'IA cria, grafo valida',
  'comp.titleA': 'Hino da',
  'comp.titleB': 'tribo',
  'comp.sub': 'O LLM compõe uma melodia no estilo da tribo. O FastPath gera o embedding dela e decide onde ela cai.',
  'comp.busy': 'Compondo...',
  'comp.composeFor': 'Compor para {name}',
  'comp.modelComposing': 'o modelo está compondo...',
  'comp.landedIn': 'o FastPath colocou a composição em',
  'comp.hit': '· acertou a tribo',
  'comp.miss': '· outra tribo!',
  'comp.byLlm': 'composto pelo LLM',
  'comp.fallback': 'composição de reserva',
  'comp.neighbors': 'vizinhos:',
  'comp.play': 'Tocar composição',

  'ask.kicker': 'pergunte ao grafo',
  'ask.titleA': 'Linguagem natural',
  'ask.placeholder': 'Ex.: quem é a alma gêmea musical da Ana?',
  'ask.answer': 'resposta',
  'ask.people': 'pessoas na resposta · clique para ouvir',
  'ask.duel': 'Duelo: {a} × {b}',
  'ask.rows': '{n} linhas do grafo',
  'ask.viewData': 'ver dados',
  'ask.viewCypher': 'ver Cypher',

  'query.most_original': 'mais original',
  'query.most_similar_pair': 'par mais parecido',
  'query.soulmate': 'alma gêmea',
  'query.tribe_of': 'tribo de',
  'query.tribes_summary': 'resumo das tribos',
  'query.fastest_tribe': 'tribo mais rápida',
  'query.speed_ranking': 'ranking de velocidade',
  'query.favorite_note': 'nota favorita',
  'query.compare': 'comparar',
  'query.numbers': 'números',

  'col.person': 'pessoa',
  'col.person1': 'pessoa 1',
  'col.person2': 'pessoa 2',
  'col.originality': 'originalidade',
  'col.profile': 'perfil',
  'col.cosine': 'cosseno',
  'col.euclidean': 'euclidiana',
  'col.score': 'score',
  'col.similar_to': 'parecido com',
  'col.is_bot': 'é robô',
  'col.tribe': 'tribo',
  'col.description': 'descrição',
  'col.peers': 'colegas',
  'col.members': 'membros',
  'col.people': 'pessoas',
  'col.notes_per_second': 'notas por segundo',
  'col.fastest': 'mais rápidos',
  'col.slowest': 'mais lentos',
  'col.note': 'nota',
  'col.times': 'vezes',
  'col.normalized_cosine': 'cosseno normalizado',
  'col.same_tribe': 'mesma tribo',
  'col.notes': 'notas',
  'col.tribes': 'tribos',
  'value.yes': 'sim',
  'value.no': 'não',

  'apps.kicker': 'e fora da música?',
  'apps.titleA': 'Troque a',
  'apps.titleB': 'nota',
  'apps.titleC': 'pelo seu evento',
  'apps.dataset': 'dataset público: {data}',
} as const

export type Key = keyof typeof pt

const en: Record<Key, string> = {
  'lang.label': 'language',

  'act.0': 'Lobby',
  'act.1': 'Algorithm',
  'act.2': 'Galaxy',
  'act.3': 'Duel',
  'act.4': 'Compose',
  'act.5': 'Ask',
  'act.6': 'Applications',

  'mode.full': 'notes + time',
  'mode.notes': 'notes only',

  'common.notes': '{n} notes',
  'common.events': '{n} events',
  'common.moreEvents': '+{n} events',
  'common.nps': 'notes/s',
  'common.play': 'Play',
  'common.ai': 'AI',
  'common.echo': 'echo',
  'common.searchPerson': 'search person...',

  'p.title1': 'Play.',
  'p.title2a': 'Become a',
  'p.title2b': 'graph',
  'p.title3': 'Find your tribe.',
  'p.introA': 'Every key becomes an event in Neo4j. The',
  'p.introB': 'algorithm turns your sequence over time into a vector and finds who played like you.',
  'p.nameLabel': 'What should we call you?',
  'p.namePlaceholder': 'Your name or nickname',
  'p.enter': 'Join the stage',
  'p.playingAs': 'Playing as',
  'p.recording': 'recording',
  'p.ready': 'done',
  'p.waitingFirst': 'waiting for 1st note',
  'p.hint1': 'Play freely for up to 20 seconds.',
  'p.hint2': 'Recording starts on the first key.',
  'p.redo': 'Redo',
  'p.saving': 'Saving to the graph',
  'p.minNotes': 'At least {n} notes',
  'p.send': 'Send melody',
  'p.waitTitle': 'Your melody is now a graph',
  'p.waitTextA': '{n} events linked by',
  'p.waitTextB': "Now it's up to the stage: as soon as FastPath runs, your tribe shows up here.",
  'p.waitingFastPath': 'waiting for FastPath',
  'p.tribe': 'tribe',
  'p.statNotes': 'notes',
  'p.statOriginality': 'originality',
  'p.soulmate': 'musical soulmate',
  'p.botTag': '(echo bot)',
  'p.listenAgain': 'Listen again',
  'p.playAnother': 'Play another',

  'stage.offlineA': 'Backend is down at',
  'stage.offlineB': 'Run',
  'stage.offlineC': 'in the server folder.',
  'stage.controls': 'controls',
  'status.fastpathLocal': 'Local FastPath',

  'ctrl.title': 'Presenter controls',
  'ctrl.session': 'AGA session:',
  'ctrl.warmup': 'Warm up AGA session',
  'ctrl.seed': 'Create echo bots (36)',
  'ctrl.seedShort': 'Create echo bots',
  'ctrl.reload': 'Reload data',
  'ctrl.reloadShort': 'Reload',
  'ctrl.clearPeople': 'Clear people (keeps echoes)',
  'ctrl.clearPeopleShort': 'Clear people',
  'ctrl.clearAll': 'Clear everything',
  'ctrl.endSession': 'End AGA session',
  'ctrl.shortcuts': 'Shortcuts: ← → acts · 1-7 · m mode · l language · f fullscreen',
  'ctrl.error': 'error',

  'lobby.scan': 'point your camera',
  'lobby.title1': 'Play a melody.',
  'lobby.title2': 'The graph listens.',
  'lobby.people': 'people played',
  'lobby.events': 'events in the graph',
  'lobby.bots': 'echo bots',

  'pipe.kicker': 'the algorithm',
  'pipe.titleA': 'Sequence',
  'pipe.titleB': 'vector',
  'pipe.titleC': 'tribe',
  'pipe.local': 'Local FastPath (simulated)',
  'pipe.running': 'FastPath running',
  'pipe.again': 'Run again',
  'pipe.run': 'Run FastPath',
  'pipe.p1title': 'Events in the graph',
  'pipe.p1sub': 'Each key is a node linked to the next',
  'pipe.waiting': 'Waiting for melodies...',
  'pipe.sameSeq': 'the same sequence over time · {n} events',
  'pipe.p2sub': 'Notes and time become an embedding',
  'pipe.dims': "{n} dimensions · {name}'s embedding",
  'pipe.noVector': 'the vector appears after running FastPath',
  'pipe.p3title': 'Similarity',
  'pipe.p3sub': 'Those who played alike end up close',
  'pipe.cosine': 'Cosine',
  'pipe.cosineText': 'Same pattern: same notes at the same moments',
  'pipe.euclidean': 'Euclidean',
  'pipe.euclideanText': 'Same intensity: number and density of notes',
  'pipe.formulaCos': '0.6 · cosine',
  'pipe.formulaEuc': '0.4 · euclidean',
  'pipe.formulaTribes': 'tribes = KMeans(embeddings) · names =',
  'pipe.done': 'Done in {s}s: {total} melodies, {people} {peopleWord}.',
  'pipe.person': 'person',
  'pipe.people': 'people',

  'step.read': 'Reading melodies from Neo4j',
  'step.project': 'Projecting the graph into Aura Graph Analytics',
  'step.fastpath_full': 'FastPath: notes + time',
  'step.fastpath_notes': 'FastPath: notes only',
  'step.knn': 'KNN: nearest neighbours',
  'step.rerank': 'Euclidean rerank, tribes and map',
  'step.llm': 'Generative AI: tribes and profiles',
  'step.write': 'Writing results to the graph',

  'warn.aga_fallback': 'Aura Graph Analytics unavailable ({detail}): using simulated local FastPath',
  'error.min_melodies': 'At least 3 melodies are needed to run FastPath',
  'error.run_first': 'Run FastPath before composing',
  'error.tribe_not_found': 'Tribe not found',
  'error.performance_not_found': 'Melody not found',
  'error.neo4j_not_configured': 'Neo4j connection is not configured',
  'error.send_failed': 'Failed to send',
  'error.compose_failed': 'Failed to compose',

  'gal.hideBots': 'hide echoes',
  'gal.showBots': 'show echoes',
  'gal.searchOpponent': 'search opponent...',
  'gal.versus': 'versus',
  'gal.clickOpponent': 'click the opponent in the galaxy',
  'gal.person': 'person',
  'gal.bot': 'echo bot',
  'gal.noTribe': 'no tribe',
  'gal.picking': 'picking B...',
  'gal.duelWith': 'Duel with...',
  'gal.mostSimilar': 'most similar',
  'gal.tribesHint': '{n} tribes · click a point',
  'empty.title': 'The galaxy is still dark',
  'empty.text': 'Run FastPath in the "Algorithm" act to light up the tribes.',

  'duel.roll': 'piano roll',
  'duel.graph': 'graph',
  'duel.together': 'Together',
  'duel.nvl': 'Neo4j Visualization Library · drag and zoom',
  'duel.cosine': 'cosine',
  'duel.euclidean': 'euclidean',
  'duel.score': 'score',
  'duel.genai': 'Generative AI',
  'duel.whySimilar': 'why are they similar?',
  'duel.whyNot': "why aren't they similar?",
  'duel.verdictOf': 'FastPath verdict',
  'duel.reading': 'reading facts from the graph...',
  'duel.noExplain': 'No explanation available.',
  'duel.footnote': 'The model only receives the numbers computed by FastPath and the facts of the melodies.',
  'duel.verdictHeader': 'verdict · cut-offs calibrated by KNN',
  'duel.reference': 'typical neighbour {a} · best neighbour {b}',
  'duel.swap': 'change {label}: type a name',
  'duel.clickToSwap': 'click to change',
  'verdict.very': 'very similar',
  'verdict.similar': 'similar',
  'verdict.weak': 'slightly similar',
  'verdict.different': 'different',
  'band.very': 'very',
  'band.similar': 'similar',
  'band.weak': 'slight',
  'band.different': 'different',

  'comp.kicker': 'AI creates, graph validates',
  'comp.titleA': "The tribe's",
  'comp.titleB': 'anthem',
  'comp.sub': "The LLM composes a melody in the tribe's style. FastPath embeds it and decides where it lands.",
  'comp.busy': 'Composing...',
  'comp.composeFor': 'Compose for {name}',
  'comp.modelComposing': 'the model is composing...',
  'comp.landedIn': 'FastPath placed the composition in',
  'comp.hit': '· right tribe',
  'comp.miss': '· another tribe!',
  'comp.byLlm': 'composed by the LLM',
  'comp.fallback': 'fallback composition',
  'comp.neighbors': 'neighbours:',
  'comp.play': 'Play composition',

  'ask.kicker': 'ask the graph',
  'ask.titleA': 'Natural language',
  'ask.placeholder': "E.g.: who is Ana's musical soulmate?",
  'ask.answer': 'answer',
  'ask.people': 'people in the answer · click to listen',
  'ask.duel': 'Duel: {a} × {b}',
  'ask.rows': '{n} rows from the graph',
  'ask.viewData': 'view data',
  'ask.viewCypher': 'view Cypher',

  'query.most_original': 'most original',
  'query.most_similar_pair': 'most similar pair',
  'query.soulmate': 'soulmate',
  'query.tribe_of': 'tribe of',
  'query.tribes_summary': 'tribes summary',
  'query.fastest_tribe': 'fastest tribe',
  'query.speed_ranking': 'speed ranking',
  'query.favorite_note': 'favorite note',
  'query.compare': 'compare',
  'query.numbers': 'numbers',

  'col.person': 'person',
  'col.person1': 'person 1',
  'col.person2': 'person 2',
  'col.originality': 'originality',
  'col.profile': 'profile',
  'col.cosine': 'cosine',
  'col.euclidean': 'euclidean',
  'col.score': 'score',
  'col.similar_to': 'similar to',
  'col.is_bot': 'is bot',
  'col.tribe': 'tribe',
  'col.description': 'description',
  'col.peers': 'peers',
  'col.members': 'members',
  'col.people': 'people',
  'col.notes_per_second': 'notes per second',
  'col.fastest': 'fastest',
  'col.slowest': 'slowest',
  'col.note': 'note',
  'col.times': 'times',
  'col.normalized_cosine': 'normalized cosine',
  'col.same_tribe': 'same tribe',
  'col.notes': 'notes',
  'col.tribes': 'tribes',
  'value.yes': 'yes',
  'value.no': 'no',

  'apps.kicker': 'and beyond music?',
  'apps.titleA': 'Swap the',
  'apps.titleB': 'note',
  'apps.titleC': 'for your event',
  'apps.dataset': 'public dataset: {data}',
}

const DICT: Record<Lang, Record<Key, string>> = { pt, en }

// ---------- data that arrives in Portuguese from the graph ----------

const NOTE_EN: Record<string, string> = { Dó: 'C', Ré: 'D', Mi: 'E', Fá: 'F', Sol: 'G', Lá: 'A', Si: 'B', 'Dó agudo': 'high C' }
const NOTE_SHORT = { pt: ['Dó', 'Ré', 'Mi', 'Fá', 'Sol', 'Lá', 'Si', 'Dó²'], en: ['C', 'D', 'E', 'F', 'G', 'A', 'B', 'C²'] }
const TAG_EN: Record<string, string> = {
  rápido: 'fast',
  contemplativo: 'contemplative',
  'sobe a escada': 'climbs the stairs',
  'desce a escada': 'goes down the stairs',
  'ping-pong': 'ping-pong',
  'silêncio e explosão': 'silence and burst',
  metrônomo: 'metronome',
  agudo: 'high',
  grave: 'low',
  médio: 'mid',
}
const ARCHETYPE_EN: Record<string, string> = {
  Rajada: 'Burst',
  'Lento e Grave': 'Slow and Low',
  Escada: 'Staircase',
  'Ping-Pong': 'Ping-Pong',
  'Silêncio e Explosão': 'Silence and Burst',
  'Agudo Saltitante': 'Bouncy High',
}

// ---------- store ----------

const STORAGE_KEY = 'fpm.lang'

function initial(): Lang {
  if (typeof window === 'undefined') return 'pt'
  const query = new URLSearchParams(window.location.search).get('lang') ?? new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('lang')
  if (query === 'pt' || query === 'en') {
    localStorage.setItem(STORAGE_KEY, query)
    return query
  }
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved === 'pt' || saved === 'en') return saved
  return navigator.language?.toLowerCase().startsWith('pt') ? 'pt' : 'en'
}

let current: Lang = initial()
const listeners = new Set<() => void>()
const applyDocument = () => {
  if (typeof document !== 'undefined') document.documentElement.lang = current === 'pt' ? 'pt-BR' : 'en'
}
applyDocument()

export function getLang(): Lang {
  return current
}

export function setLang(lang: Lang) {
  if (lang === current) return
  current = lang
  localStorage.setItem(STORAGE_KEY, lang)
  applyDocument()
  listeners.forEach((fn) => fn())
}

const subscribe = (fn: () => void) => {
  listeners.add(fn)
  return () => listeners.delete(fn)
}

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>): string {
  const text = DICT[lang][key] ?? DICT.pt[key] ?? key
  return vars ? text.replace(/\{(\w+)\}/g, (_, v) => String(vars[v] ?? '')) : text
}

/** Picks `field_en` when the UI is in English and the graph has it, otherwise the Portuguese `field`. */
export function localized<T extends object>(obj: T | null | undefined, field: string, lang: Lang): string {
  if (!obj) return ''
  const o = obj as Record<string, unknown>
  const value = lang === 'en' ? o[`${field}_en`] ?? o[field] : o[field]
  return value == null ? '' : String(value)
}

/** Echo bots are stored as "Eco <Arquétipo> <n>"; AI compositions may carry a `name_en`. */
export function botName(name: string, lang: Lang): string {
  if (lang === 'pt') return name
  const m = /^Eco (.+) (\d+)$/.exec(name)
  return m ? `Echo ${ARCHETYPE_EN[m[1]] ?? m[1]} ${m[2]}` : name
}

export function displayName(p: { name: string; isBot?: boolean | null; name_en?: string | null } | null | undefined, lang: Lang): string {
  if (!p) return ''
  if (lang === 'en' && p.name_en) return p.name_en
  return p.isBot ? botName(p.name, lang) : p.name
}

export function useI18n() {
  const lang = useSyncExternalStore(subscribe, getLang, getLang)
  return useMemo(
    () => ({
      lang,
      setLang,
      t: (key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars),
      /** For keys built at runtime (column aliases, query ids): falls back when the key is unknown. */
      maybe: (key: string, fallback: string) => (key in DICT.pt ? translate(lang, key as Key) : fallback),
      /** Error messages thrown as `i18n:<key>` by the API client and the server. */
      err: (message: string) => (message.startsWith('i18n:') ? translate(lang, `error.${message.slice(5)}` as Key) : message),
      noteShort: (code: number) => NOTE_SHORT[lang][code] ?? '',
      note: (label: string) => (lang === 'en' ? NOTE_EN[label] ?? label : label),
      tag: (tag: string) => (lang === 'en' ? TAG_EN[tag] ?? tag : tag),
      name: (p: Parameters<typeof displayName>[0]) => displayName(p, lang),
      loc: <T extends object>(obj: T | null | undefined, field: string) => localized(obj, field, lang),
    }),
    [lang],
  )
}

export type I18n = ReturnType<typeof useI18n>
