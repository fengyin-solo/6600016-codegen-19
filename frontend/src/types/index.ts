export interface MorseSymbol {
  char: string
  code: string
}

export type TrainMode = 'charToCode' | 'codeToChar' | 'audioToChar' | 'typingToCode'

export interface HistoryEntry {
  id: number
  input: string
  output: string
  correct: boolean
  timestamp: number
  responseTimeMs: number
}

export type BadgeCategory = 'streak' | 'speed' | 'accuracy'
export type BadgeTier = 'bronze' | 'silver' | 'gold' | 'platinum'

export interface BadgeDefinition {
  id: string
  category: BadgeCategory
  tier: BadgeTier
  name: string
  description: string
  icon: string
  requirement: number
  unit: string
}

export interface BadgeProgress {
  current: number
  total: number
  percentage: number
}

export interface BadgeState {
  unlockedAt: number
  progress: BadgeProgress
}

export interface BadgeStore {
  definitions: BadgeDefinition[]
  states: Record<string, BadgeState>
  currentStreak: number
  bestStreak: number
  totalResponseTimeMs: number
  answeredCount: number
  recentTimes: number[]
}
