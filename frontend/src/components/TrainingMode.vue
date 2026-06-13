<template>
  <div class="grid grid-cols-1 lg:grid-cols-3 gap-4">
    <!-- Quiz Panel -->
    <div class="bg-gray-900 rounded-xl p-4">
      <h3 class="text-amber-300 font-bold mb-3">听音/看码 猜字符</h3>
      <div v-if="!store.quizChar" class="text-center py-8">
        <button @click="startTraining" class="bg-amber-500 text-black px-6 py-3 rounded-lg text-lg hover:bg-amber-400">
          开始训练
        </button>
      </div>
      <div v-else class="flex flex-col items-center gap-4">
        <div class="text-8xl font-bold text-amber-400">{{ store.quizChar }}</div>
        <button @click="store.playMorse(MORSE_TABLE[store.quizChar])" :disabled="store.isPlaying"
          class="bg-green-600 px-4 py-2 rounded hover:bg-green-500 disabled:opacity-50">
          {{ store.isPlaying ? '播放中...' : '🔊 播放音频' }}
        </button>
        <div class="text-2xl font-mono text-green-400">{{ MORSE_TABLE[store.quizChar] }}</div>
        <input v-model="store.userAnswer" @keyup.enter="store.checkAnswer()"
          class="bg-gray-800 rounded px-4 py-2 text-center text-xl w-48" placeholder="输入莫尔斯码" />
        <button @click="store.checkAnswer()" class="bg-amber-500 text-black px-6 py-2 rounded hover:bg-amber-400">
          确认
        </button>
      </div>
    </div>

    <!-- Score & Stats -->
    <div class="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <h3 class="text-amber-300 font-bold">训练统计</h3>
        <button @click="store.resetScore()" class="text-red-400 text-sm hover:underline">重置</button>
      </div>
      <div class="grid grid-cols-2 gap-2 text-center">
        <div class="bg-gray-800 rounded p-2">
          <div class="text-2xl font-bold text-green-400">{{ store.score.correct }}</div>
          <div class="text-xs text-gray-400">正确</div>
        </div>
        <div class="bg-gray-800 rounded p-2">
          <div class="text-2xl font-bold text-red-400">{{ store.score.total - store.score.correct }}</div>
          <div class="text-xs text-gray-400">错误</div>
        </div>
        <div class="bg-gray-800 rounded p-2">
          <div class="text-2xl font-bold text-amber-400">
            {{ store.score.total ? Math.round(store.score.correct / store.score.total * 100) : 0 }}%
          </div>
          <div class="text-xs text-gray-400">正确率</div>
        </div>
        <div class="bg-gray-800 rounded p-2">
          <div class="text-2xl font-bold text-orange-400">
            {{ store.averageResponseTime ? (store.averageResponseTime / 1000).toFixed(1) + 's' : '--' }}
          </div>
          <div class="text-xs text-gray-400">平均用时</div>
        </div>
      </div>
      <div class="bg-gray-800 rounded p-3">
        <div class="flex justify-between items-center mb-1">
          <span class="text-sm text-gray-400">当前连胜</span>
          <span class="text-lg font-bold" :class="store.badges.currentStreak >= 5 ? 'text-orange-400' : 'text-gray-300'">
            🔥 {{ store.badges.currentStreak }}
          </span>
        </div>
        <div class="flex justify-between items-center">
          <span class="text-sm text-gray-400">最高连胜</span>
          <span class="text-lg font-bold text-amber-400">
            🏆 {{ store.badges.bestStreak }}
          </span>
        </div>
      </div>
      <div class="flex-1 overflow-y-auto max-h-48">
        <div v-for="h in store.history.slice(0, 20)" :key="h.id"
          class="flex justify-between bg-gray-800 rounded p-2 mb-1 text-sm"
          :class="h.correct ? 'border-l-4 border-green-500' : 'border-l-4 border-red-500'">
          <span>{{ h.input }} → {{ h.output }}</span>
          <div class="flex items-center gap-2">
            <span class="text-xs text-gray-500">{{ (h.responseTimeMs / 1000).toFixed(1) }}s</span>
            <span>{{ h.correct ? '✓' : '✗' }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Badges Panel -->
    <div class="bg-gray-900 rounded-xl p-4 flex flex-col gap-3">
      <div class="flex justify-between items-center">
        <h3 class="text-amber-300 font-bold">成就徽章</h3>
        <span class="text-sm text-gray-400">
          {{ store.unlockedBadgesCount }} / {{ store.badges.definitions.length }}
        </span>
      </div>

      <div v-for="category in badgeCategories" :key="category.key" class="mb-2">
        <div class="flex items-center gap-2 mb-2">
          <span class="text-lg">{{ category.icon }}</span>
          <span class="text-sm font-medium text-gray-300">{{ category.name }}</span>
        </div>
        <div class="space-y-2">
          <div v-for="badge in getBadgesByCategory(category.key)" :key="badge.id"
            class="relative bg-gray-800 rounded-lg p-2 transition-all"
            :class="isUnlocked(badge.id) ? 'ring-2 ring-amber-500/50' : 'opacity-60'">
            <div class="flex items-center gap-2">
              <div class="w-10 h-10 rounded-lg flex items-center justify-center text-2xl"
                :class="getBadgeBgClass(badge, isUnlocked(badge.id))">
                {{ badge.icon }}
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-1">
                  <span class="text-sm font-medium text-white truncate">{{ badge.name }}</span>
                  <span v-if="isUnlocked(badge.id)" class="text-xs text-green-400">✓</span>
                </div>
                <p class="text-xs text-gray-400 truncate">{{ badge.description }}</p>
              </div>
            </div>
            <div v-if="!isUnlocked(badge.id)" class="mt-2">
              <div class="flex justify-between text-xs text-gray-500 mb-1">
                <span>{{ getProgressText(badge) }}</span>
                <span>{{ getProgress(badge.id).percentage }}%</span>
              </div>
              <div class="h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div class="h-full rounded-full transition-all duration-300"
                  :class="getTierColor(badge.tier)"
                  :style="{ width: getProgress(badge.id).percentage + '%' }"></div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <button @click="resetAllBadges"
        class="mt-auto text-xs text-gray-500 hover:text-red-400 transition-colors">
        重置所有徽章
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { useMorseStore } from '../store/morse'
import { MORSE_TABLE } from '../utils/morse-code'
import type { BadgeDefinition, BadgeCategory } from '../types'

const store = useMorseStore()

const badgeCategories: { key: BadgeCategory; name: string; icon: string }[] = [
  { key: 'streak', name: '连胜成就', icon: '🔥' },
  { key: 'speed', name: '速度成就', icon: '⚡' },
  { key: 'accuracy', name: '正确率成就', icon: '🎯' },
]

function getBadgesByCategory(category: BadgeCategory): BadgeDefinition[] {
  return store.badges.definitions.filter(b => b.category === category)
}

function isUnlocked(badgeId: string): boolean {
  return store.badges.states[badgeId]?.unlockedAt > 0
}

function getProgress(badgeId: string) {
  if (store.badges.states[badgeId]) {
    return store.badges.states[badgeId].progress
  }
  return store.calculateProgress(badgeId)
}

function getProgressText(badge: BadgeDefinition): string {
  const progress = getProgress(badge.id)
  if (badge.category === 'streak') {
    return `${progress.current} / ${progress.total} 连胜`
  } else if (badge.category === 'speed') {
    if (store.badges.answeredCount < 5) {
      return `需完成 5 题 (${store.badges.answeredCount}/5)`
    }
    const avgTime = store.averageResponseTime
    const target = badge.requirement
    return `${avgTime}ms / ${target}ms`
  } else {
    const minCount = { accuracy_bronze: 10, accuracy_silver: 50, accuracy_gold: 100, accuracy_platinum: 200 }[badge.id] || 10
    if (store.score.total < minCount) {
      return `需完成 ${minCount} 题 (${store.score.total}/${minCount})`
    }
    const accuracy = store.score.total > 0 ? Math.round(store.score.correct / store.score.total * 100) : 0
    return `${accuracy}% / ${badge.requirement}%`
  }
}

function getTierColor(tier: string): string {
  const colors: Record<string, string> = {
    bronze: 'bg-amber-700',
    silver: 'bg-gray-400',
    gold: 'bg-yellow-500',
    platinum: 'bg-cyan-400',
  }
  return colors[tier] || 'bg-gray-500'
}

function getBadgeBgClass(badge: BadgeDefinition, unlocked: boolean): string {
  if (!unlocked) return 'bg-gray-700'
  const classes: Record<string, string> = {
    bronze: 'bg-amber-900/50',
    silver: 'bg-gray-600/50',
    gold: 'bg-yellow-900/50',
    platinum: 'bg-cyan-900/50',
  }
  return classes[badge.tier] || 'bg-gray-700'
}

function startTraining() {
  store.generateQuiz()
  store.checkBadges()
}

function resetAllBadges() {
  if (confirm('确定要重置所有徽章吗？此操作不可撤销。')) {
    store.resetBadges()
    store.resetScore()
  }
}
</script>
