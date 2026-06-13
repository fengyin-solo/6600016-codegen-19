import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { MORSE_TABLE, REVERSE_TABLE, textToMorse, morseToText } from '../utils/morse-code'
import type { TrainMode, HistoryEntry, BadgeDefinition, BadgeStore, BadgeProgress } from '../types'

const BADGE_DEFINITIONS: BadgeDefinition[] = [
  { id: 'streak_bronze', category: 'streak', tier: 'bronze', name: '初试锋芒', description: '连续答对 5 题', icon: '🔥', requirement: 5, unit: '连胜' },
  { id: 'streak_silver', category: 'streak', tier: 'silver', name: '渐入佳境', description: '连续答对 10 题', icon: '⭐', requirement: 10, unit: '连胜' },
  { id: 'streak_gold', category: 'streak', tier: 'gold', name: '炉火纯青', description: '连续答对 25 题', icon: '🏆', requirement: 25, unit: '连胜' },
  { id: 'streak_platinum', category: 'streak', tier: 'platinum', name: '莫尔斯大师', description: '连续答对 50 题', icon: '👑', requirement: 50, unit: '连胜' },
  { id: 'speed_bronze', category: 'speed', tier: 'bronze', name: '快速反应', description: '平均答题时间 10 秒内', icon: '⚡', requirement: 10000, unit: '毫秒' },
  { id: 'speed_silver', category: 'speed', tier: 'silver', name: '闪电手速', description: '平均答题时间 5 秒内', icon: '🌩️', requirement: 5000, unit: '毫秒' },
  { id: 'speed_gold', category: 'speed', tier: 'gold', name: '电光石火', description: '平均答题时间 3 秒内', icon: '💫', requirement: 3000, unit: '毫秒' },
  { id: 'speed_platinum', category: 'speed', tier: 'platinum', name: '神速', description: '平均答题时间 2 秒内', icon: '🚀', requirement: 2000, unit: '毫秒' },
  { id: 'accuracy_bronze', category: 'accuracy', tier: 'bronze', name: '准确无误', description: '10 题正确率 90%', icon: '🎯', requirement: 90, unit: '%' },
  { id: 'accuracy_silver', category: 'accuracy', tier: 'silver', name: '精准打击', description: '50 题正确率 85%', icon: '💎', requirement: 85, unit: '%' },
  { id: 'accuracy_gold', category: 'accuracy', tier: 'gold', name: '百步穿杨', description: '100 题正确率 80%', icon: '🌟', requirement: 80, unit: '%' },
  { id: 'accuracy_platinum', category: 'accuracy', tier: 'platinum', name: '传奇射手', description: '200 题正确率 75%', icon: '🏅', requirement: 75, unit: '%' },
]

const ACCURACY_MIN_COUNTS: Record<string, number> = {
  accuracy_bronze: 10,
  accuracy_silver: 50,
  accuracy_gold: 100,
  accuracy_platinum: 200,
}

export const useMorseStore = defineStore('morse', () => {
  const inputText = ref('')
  const morseOutput = ref('')
  const decodedText = ref('')
  const wpm = ref(15)
  const frequency = ref(700)
  const volume = ref(0.6)
  const trainMode = ref<TrainMode>('charToCode')
  const history = ref<HistoryEntry[]>([])
  const quizChar = ref('')
  const userAnswer = ref('')
  const score = ref({ correct: 0, total: 0 })
  const isPlaying = ref(false)
  let audioCtx: AudioContext | null = null
  let currentOscillator: OscillatorNode | null = null

  const quizStartTime = ref(0)
  const badges = ref<BadgeStore>({
    definitions: BADGE_DEFINITIONS,
    states: {},
    currentStreak: 0,
    bestStreak: 0,
    totalResponseTimeMs: 0,
    answeredCount: 0,
    recentTimes: [],
  })

  const dotDuration = computed(() => 1200 / wpm.value)

  function getAudioCtx(): AudioContext {
    if (!audioCtx) audioCtx = new AudioContext()
    return audioCtx
  }

  function playTone(duration: number): Promise<void> {
    return new Promise(resolve => {
      const ctx = getAudioCtx()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = frequency.value
      gain.gain.value = volume.value
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start()
      currentOscillator = osc
      setTimeout(() => { osc.stop(); currentOscillator = null; resolve() }, duration)
    })
  }

  async function playMorse(morse: string) {
    isPlaying.value = true
    const dd = dotDuration.value
    for (const token of morse.split(' ')) {
      if (token === '/') { await sleep(dd * 7); continue }
      for (const sym of token) {
        await playTone(sym === '.' ? dd : dd * 3)
        await sleep(dd)
      }
      await sleep(dd * 2)
    }
    isPlaying.value = false
  }

  function sleep(ms: number): Promise<void> {
    return new Promise(r => setTimeout(r, ms))
  }

  function encode() {
    morseOutput.value = textToMorse(inputText.value)
  }

  function decode() {
    decodedText.value = morseToText(inputText.value)
  }

  function generateQuiz() {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'
    quizChar.value = chars[Math.floor(Math.random() * chars.length)]
    userAnswer.value = ''
    quizStartTime.value = Date.now()
  }

  function calculateProgress(badgeId: string): BadgeProgress {
    const def = BADGE_DEFINITIONS.find(d => d.id === badgeId)
    if (!def) return { current: 0, total: 1, percentage: 0 }

    let current = 0
    let total = def.requirement

    if (def.category === 'streak') {
      current = Math.min(badges.value.bestStreak, def.requirement)
    } else if (def.category === 'speed') {
      if (badges.value.answeredCount < 5) {
        return { current: 0, total: def.requirement, percentage: 0 }
      }
      const avgTime = badges.value.totalResponseTimeMs / badges.value.answeredCount
      current = avgTime <= def.requirement ? def.requirement : Math.max(0, def.requirement * 2 - avgTime)
      total = def.requirement
    } else if (def.category === 'accuracy') {
      const minCount = ACCURACY_MIN_COUNTS[badgeId] || 10
      if (score.value.total < minCount) {
        return { current: 0, total: minCount, percentage: 0 }
      }
      const accuracy = score.value.total > 0 ? (score.value.correct / score.value.total) * 100 : 0
      current = Math.min(accuracy, def.requirement)
      total = def.requirement
    }

    return {
      current: Math.round(current),
      total,
      percentage: Math.min(100, Math.round((current / total) * 100)),
    }
  }

  function checkBadges() {
    for (const def of BADGE_DEFINITIONS) {
      if (badges.value.states[def.id]?.unlockedAt) continue

      const progress = calculateProgress(def.id)
      let unlocked = false

      if (def.category === 'streak') {
        unlocked = badges.value.bestStreak >= def.requirement
      } else if (def.category === 'speed') {
        if (badges.value.answeredCount >= 5) {
          const avgTime = badges.value.totalResponseTimeMs / badges.value.answeredCount
          unlocked = avgTime <= def.requirement
        }
      } else if (def.category === 'accuracy') {
        const minCount = ACCURACY_MIN_COUNTS[def.id] || 10
        if (score.value.total >= minCount) {
          const accuracy = (score.value.correct / score.value.total) * 100
          unlocked = accuracy >= def.requirement
        }
      }

      badges.value.states[def.id] = {
        unlockedAt: unlocked ? Date.now() : 0,
        progress,
      }
    }
  }

  function checkAnswer() {
    const responseTimeMs = Date.now() - quizStartTime.value
    const correct = userAnswer.value.trim() === MORSE_TABLE[quizChar.value]
    score.value.total++
    if (correct) {
      score.value.correct++
      badges.value.currentStreak++
      if (badges.value.currentStreak > badges.value.bestStreak) {
        badges.value.bestStreak = badges.value.currentStreak
      }
    } else {
      badges.value.currentStreak = 0
    }
    badges.value.answeredCount++
    badges.value.totalResponseTimeMs += responseTimeMs
    badges.value.recentTimes.push(responseTimeMs)
    if (badges.value.recentTimes.length > 20) {
      badges.value.recentTimes.shift()
    }
    history.value.unshift({
      id: Date.now(), input: quizChar.value, output: userAnswer.value,
      correct, timestamp: Date.now(), responseTimeMs
    })
    checkBadges()
    generateQuiz()
  }

  function resetScore() {
    score.value = { correct: 0, total: 0 }
    history.value = []
    badges.value.currentStreak = 0
    badges.value.totalResponseTimeMs = 0
    badges.value.answeredCount = 0
    badges.value.recentTimes = []
    for (const def of BADGE_DEFINITIONS) {
      const state = badges.value.states[def.id]
      if (state && !state.unlockedAt) {
        state.progress = calculateProgress(def.id)
      }
    }
  }

  function resetBadges() {
    badges.value.states = {}
    badges.value.currentStreak = 0
    badges.value.bestStreak = 0
    badges.value.totalResponseTimeMs = 0
    badges.value.answeredCount = 0
    badges.value.recentTimes = []
  }

  const averageResponseTime = computed(() => {
    if (badges.value.answeredCount === 0) return 0
    return Math.round(badges.value.totalResponseTimeMs / badges.value.answeredCount)
  })

  const unlockedBadgesCount = computed(() => {
    return Object.values(badges.value.states).filter(s => s.unlockedAt > 0).length
  })

  return {
    inputText, morseOutput, decodedText, wpm, frequency, volume,
    trainMode, history, quizChar, userAnswer, score, isPlaying,
    dotDuration, encode, decode, playMorse, playTone,
    generateQuiz, checkAnswer, resetScore, badges,
    resetBadges, calculateProgress, averageResponseTime,
    unlockedBadgesCount, checkBadges
  }
})
