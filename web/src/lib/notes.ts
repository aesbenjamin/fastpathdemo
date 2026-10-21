export type NoteDef = {
  code: number
  name: string
  label: string
  short: string
  color: string
}

export const NOTES: NoteDef[] = [
  { code: 0, name: 'C4', label: 'Dó', short: 'Dó', color: '#FF3D71' },
  { code: 1, name: 'D4', label: 'Ré', short: 'Ré', color: '#FF8A3D' },
  { code: 2, name: 'E4', label: 'Mi', short: 'Mi', color: '#FFD23F' },
  { code: 3, name: 'F4', label: 'Fá', short: 'Fá', color: '#3DDC97' },
  { code: 4, name: 'G4', label: 'Sol', short: 'Sol', color: '#2EC4FF' },
  { code: 5, name: 'A4', label: 'Lá', short: 'Lá', color: '#4D7CFF' },
  { code: 6, name: 'B4', label: 'Si', short: 'Si', color: '#9B5CFF' },
  { code: 7, name: 'C5', label: 'Dó agudo', short: 'Dó²', color: '#FF4FD8' },
]

export const TRIBE_COLORS = ['#2EC4FF', '#FF4FD8', '#FFD23F', '#3DDC97', '#FF8A3D', '#9B5CFF', '#FF3D71', '#7CF3FF']

export const MAX_DURATION_MS = 20000
export const MIN_NOTES = 3

export type NoteEvent = { t: number; code: number }

export const noteColor = (code: number) => NOTES[code]?.color ?? '#fff'

export const tribeColor = (tribeId?: string | null) => {
  if (!tribeId) return '#8d8aa8'
  const index = Number(tribeId.split('-')[1] ?? 0)
  return TRIBE_COLORS[index % TRIBE_COLORS.length]
}
