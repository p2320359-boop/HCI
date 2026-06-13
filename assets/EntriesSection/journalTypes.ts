export type PersonaKey =
  | 'cartographer'
  | 'tidekeeper'
  | 'navigator'
  | 'voidwalker'

export interface JournalEntry {
  emotion: string
  intensity: number
  image?: string
  note?: string
  tags?: string[]
}

export type EntriesMap = Record<number, JournalEntry>