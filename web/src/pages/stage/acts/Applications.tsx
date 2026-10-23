import { motion } from 'framer-motion'
import { useI18n, type Lang } from '../../../lib/i18n'

type Mapping = { from: string; to: string }
type Use = { color: string; title: string; text: string; data: string; gaps: number[]; events: Partial<Record<number, string>> }

const MAPPING: Record<Lang, Mapping[]> = {
  pt: [
    { from: 'Pessoa', to: 'Cliente, paciente, conta, máquina' },
    { from: 'Nota', to: 'Evento: compra, login, consulta, alarme' },
    { from: 'Tempo', to: 'Quando aconteceu, relativo a hoje' },
    { from: 'Tribo', to: 'Segmento comportamental' },
  ],
  en: [
    { from: 'Person', to: 'Customer, patient, account, machine' },
    { from: 'Note', to: 'Event: purchase, login, visit, alarm' },
    { from: 'Time', to: 'When it happened, relative to today' },
    { from: 'Tribe', to: 'Behavioural segment' },
  ],
}

const USES: Record<Lang, Use[]> = {
  pt: [
    { color: '#2EC4FF', title: 'Jornada do cliente', text: 'Encontrar clientes com a mesma trajetória de navegação, compra e atendimento para prever conversão ou churn.', data: 'Olist, REES46 eCommerce, Retailrocket', gaps: [0, 0.07, 0.24, 0.3, 0.62, 0.9], events: { 0: 'visita', 2: 'carrinho', 4: 'cupom', 5: 'compra' } },
    { color: '#FF3D71', title: 'Fraude e risco', text: 'Três logins falhos em 5 segundos não é o mesmo que em um mês. Vetores capturam o ritmo da fraude.', data: 'PaySim, IBM Credit Card Transactions', gaps: [0, 0.04, 0.08, 0.12, 0.85, 0.89], events: { 0: '3 falhas em 5s', 4: 'saque' } },
    { color: '#3DDC97', title: 'Saúde', text: 'Pacientes com históricos parecidos de consultas, exames e internações, para coortes e próximos passos.', data: 'Synthea, MIMIC-IV Demo', gaps: [0, 0.3, 0.38, 0.7, 0.95], events: { 0: 'consulta', 1: 'exames', 3: 'internação', 4: 'alta' } },
    { color: '#FFD23F', title: 'Manutenção preditiva', text: 'Sequências de alarmes e leituras de sensores que antecedem falhas em equipamentos.', data: 'NASA C-MAPSS', gaps: [0, 0.25, 0.5, 0.68, 0.8, 0.88, 0.94], events: { 0: 'vibração', 2: 'calor', 4: 'alarmes', 6: 'falha' } },
    { color: '#9B5CFF', title: 'Processos e operações', text: 'Casos de um processo (crédito, sinistro, pedido) com o mesmo caminho e o mesmo tempo entre etapas.', data: 'BPI Challenge 2017', gaps: [0, 0.2, 0.4, 0.6, 0.8], events: { 0: 'abertura', 1: 'análise', 2: 'pendência', 3: 'oferta', 4: 'aprovação' } },
    { color: '#FF4FD8', title: 'Conteúdo e streaming', text: 'Usuários que consomem na mesma ordem e no mesmo ritmo, para recomendação e retenção.', data: 'KKBox Churn, Last.fm 1K', gaps: [0, 0.08, 0.16, 0.42, 0.5, 0.58, 0.84, 0.92], events: { 0: 'maratona', 3: 'maratona', 6: 'maratona' } },
  ],
  en: [
    { color: '#2EC4FF', title: 'Customer journey', text: 'Find customers with the same browsing, purchase and support path to predict conversion or churn.', data: 'Olist, REES46 eCommerce, Retailrocket', gaps: [0, 0.07, 0.24, 0.3, 0.62, 0.9], events: { 0: 'visit', 2: 'cart', 4: 'coupon', 5: 'purchase' } },
    { color: '#FF3D71', title: 'Fraud and risk', text: 'Three failed logins in 5 seconds is not the same as in a month. Vectors capture the rhythm of fraud.', data: 'PaySim, IBM Credit Card Transactions', gaps: [0, 0.04, 0.08, 0.12, 0.85, 0.89], events: { 0: '3 failures in 5s', 4: 'withdrawal' } },
    { color: '#3DDC97', title: 'Healthcare', text: 'Patients with similar histories of visits, tests and admissions, for cohorts and next steps.', data: 'Synthea, MIMIC-IV Demo', gaps: [0, 0.3, 0.38, 0.7, 0.95], events: { 0: 'visit', 1: 'tests', 3: 'admission', 4: 'discharge' } },
    { color: '#FFD23F', title: 'Predictive maintenance', text: 'Sequences of alarms and sensor readings that come before equipment failures.', data: 'NASA C-MAPSS', gaps: [0, 0.25, 0.5, 0.68, 0.8, 0.88, 0.94], events: { 0: 'vibration', 2: 'heat', 4: 'alarms', 6: 'failure' } },
    { color: '#9B5CFF', title: 'Processes and operations', text: 'Cases of a process (loan, claim, order) with the same path and the same time between steps.', data: 'BPI Challenge 2017', gaps: [0, 0.2, 0.4, 0.6, 0.8], events: { 0: 'opening', 1: 'review', 2: 'pending', 3: 'offer', 4: 'approval' } },
    { color: '#FF4FD8', title: 'Content and streaming', text: 'Users who consume in the same order and at the same pace, for recommendation and retention.', data: 'KKBox Churn, Last.fm 1K', gaps: [0, 0.08, 0.16, 0.42, 0.5, 0.58, 0.84, 0.92], events: { 0: 'binge', 3: 'binge', 6: 'binge' } },
  ],
}

function EventTrail({ color, gaps, events, delay }: { color: string; gaps: number[]; events: Partial<Record<number, string>>; delay: number }) {
  return (
    <div className="relative mt-2 h-14">
      <div className="absolute left-0 right-0 top-5 h-px" style={{ background: `linear-gradient(90deg, ${color}66, transparent)` }} />
      {gaps.map((g, i) => (
        <motion.div
          key={i}
          className="absolute top-5 -translate-x-1/2 -translate-y-1/2"
          style={{ left: `${4 + g * 90}%` }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: delay + i * 0.08, type: 'spring', stiffness: 300 }}
        >
          <span className="block h-3.5 w-3.5 rounded-full" style={{ background: color, boxShadow: `0 0 14px ${color}` }} />
          {events[i] && <span className="absolute left-0 top-5 whitespace-nowrap font-mono text-[10px] text-white/45">{events[i]}</span>}
        </motion.div>
      ))}
    </div>
  )
}

export function Applications() {
  const { t, lang } = useI18n()
  return (
    <div className="flex h-full flex-col gap-8 px-14 pb-10">
      <div className="flex items-end justify-between gap-10">
        <div>
          <p className="font-mono text-sm uppercase tracking-[0.35em] text-mute">{t('apps.kicker')}</p>
          <h2 className="mt-2 font-display text-6xl font-bold tracking-tight">
            {t('apps.titleA')} <span className="text-gradient">{t('apps.titleB')}</span> {t('apps.titleC')}
          </h2>
        </div>
        <div className="grid grid-cols-4 gap-3">
          {MAPPING[lang].map((m, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 * i }} className="glass w-52 rounded-2xl px-4 py-3">
              <p className="font-display text-lg font-bold">{m.from}</p>
              <p className="text-sm text-white/55">{m.to}</p>
            </motion.div>
          ))}
        </div>
      </div>
      <div className="grid flex-1 grid-cols-3 grid-rows-2 gap-5">
        {USES[lang].map((u, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 + i * 0.1 }}
            className="relative flex flex-col gap-3 overflow-hidden rounded-[28px] p-7"
            style={{ background: `linear-gradient(150deg, ${u.color}22, rgba(255,255,255,.02) 60%)`, boxShadow: `inset 0 0 0 1px ${u.color}40` }}
          >
            <span className="absolute -right-10 -top-10 h-40 w-40 rounded-full opacity-30 blur-3xl" style={{ background: u.color }} />
            <h3 className="font-display text-3xl font-bold" style={{ color: u.color }}>{u.title}</h3>
            <p className="text-lg leading-relaxed text-white/75">{u.text}</p>
            <EventTrail color={u.color} gaps={u.gaps} events={u.events} delay={0.6 + i * 0.1} />
            <p className="mt-auto font-mono text-xs uppercase tracking-wider text-white/40">{t('apps.dataset', { data: u.data })}</p>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
