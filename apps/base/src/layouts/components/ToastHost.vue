<script setup lang="ts">
import { useAppStore } from '@/stores/app'
import AppIcon from '@/components/AppIcon.vue'

const appStore = useAppStore()

const ICON_NAMES = { ok: 'checkCircle', bad: 'xCircle', info: 'info' } as const
</script>

<template>
  <div class="toasts">
    <transition-group name="toast">
      <div v-for="t in appStore.toasts" :key="t.id" class="toast" :class="`toast--${t.type}`">
        <AppIcon :name="ICON_NAMES[t.type]" :size="15" />
        <span>{{ t.text }}</span>
      </div>
    </transition-group>
  </div>
</template>

<style scoped>
.toasts {
  position: fixed; top: 58px; right: 18px; z-index: 99;
  display: flex; flex-direction: column; gap: 9px;
  pointer-events: none;
}
.toast {
  display: flex; align-items: center; gap: 9px;
  padding: 10px 15px; min-width: 220px; max-width: 360px;
  background: var(--bg-float);
  border: 1px solid var(--border);
  border-radius: 12px;
  box-shadow: var(--shadow-float);
  font-size: 12.5px;
}
.toast--ok { color: var(--sev-low); }
.toast--bad { color: var(--sev-critical); }
.toast--info { color: var(--primary); }
.toast span { color: var(--fg); }

.toast-enter-active, .toast-leave-active { transition: all 0.25s ease; }
.toast-enter-from, .toast-leave-to { opacity: 0; transform: translateX(14px); }
</style>
