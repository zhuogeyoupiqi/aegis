<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { useUserStore } from '@/stores/user'
import { useAppStore } from '@/stores/app'
import { useMenuStore, type FlatMenuItem } from '@/stores/menu'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const userStore = useUserStore()
const appStore = useAppStore()
const menuStore = useMenuStore()
const { t } = useI18n()

/** 按时段问候（词条表驱动，新增时段只改语言包） */
const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return t('workbench.greet.night')
  if (h < 11) return t('workbench.greet.morning')
  if (h < 13) return t('workbench.greet.noon')
  if (h < 18) return t('workbench.greet.afternoon')
  return t('workbench.greet.evening')
})

/** 日期展示跟随界面语言（中文「8月31日 星期一」/ 英文 "Monday, August 31, 2026"） */
const today = computed(() =>
  new Date().toLocaleDateString(appStore.prefs.lang === 'en-US' ? 'en-US' : 'zh-CN', {
    year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
  }),
)

const stats = computed(() => [
  { icon: 'zap', label: t('workbench.stats.tools'), value: '6' },
  { icon: 'activity', label: t('workbench.stats.samples'), value: '1,284' },
  { icon: 'syslog', label: t('workbench.stats.sent'), value: '3,208' },
  { icon: 'assets', label: t('workbench.stats.knowledge'), value: '12' },
])

/** 第 1 周验证清单：交付自检用，后续迭代替换为迭代看板 */
const checklist = computed(() => [
  { label: t('workbench.checklist.monorepo'), done: true },
  { label: t('workbench.checklist.contract'), done: true },
  { label: t('workbench.checklist.loginMenu'), done: true },
  { label: t('workbench.checklist.theme'), done: true },
  { label: t('workbench.checklist.tags'), done: true },
  { label: t('workbench.checklist.microApp'), done: true },
  { label: t('workbench.checklist.syslog'), done: true },
  { label: t('workbench.checklist.backend'), done: false },
])

function go(item: FlatMenuItem): void {
  router.push(item.path)
}
</script>

<template>
  <div class="workbench">
    <!-- 问候横幅 -->
    <section class="hello panel">
      <div class="hello__main">
        <h1>{{ greeting }}，{{ userStore.userInfo?.nickname || t('workbench.greet.fallback') }}</h1>
        <p>{{ t('workbench.subtitle', { date: today }) }}</p>
      </div>
      <a-tag class="hello__badge" color="purple">v0.1.0</a-tag>
    </section>

    <!-- 统计卡 -->
    <section class="stats">
      <div v-for="s in stats" :key="s.label" class="stat panel">
        <span class="stat__icon"><AppIcon :name="s.icon" :size="16" /></span>
        <div>
          <b>{{ s.value }}</b>
          <span>{{ s.label }}</span>
        </div>
      </div>
    </section>

    <div class="grid">
      <!-- 快捷入口：来自菜单数据（单一事实来源），未开放的打「建设中」标 -->
      <section class="panel">
        <div class="panel-head">
          <AppIcon name="workbench" :size="15" />
          <h2>{{ t('workbench.quickEntry') }}</h2>
          <span class="sub">{{ t('workbench.quickEntrySub') }}</span>
        </div>
        <div class="panel-body entries">
          <button
            v-for="item in menuStore.flatItems"
            :key="item.key"
            class="entry"
            :class="{ stub: item.stub }"
            @click="go(item)"
          >
            <span class="entry__icon"><AppIcon :name="item.icon || 'apps'" :size="17" /></span>
            <b>{{ t(`menu.items.${item.key}`) }}</b>
            <span class="entry__group">{{ t(`menu.groups.${item.groupKey}`) }}</span>
            <a-tag v-if="item.stub" class="entry__badge">{{ t('workbench.building') }}</a-tag>
          </button>
        </div>
      </section>

      <!-- 验证清单 -->
      <section class="panel">
        <div class="panel-head">
          <AppIcon name="checkCircle" :size="15" />
          <h2>{{ t('workbench.checklistTitle') }}</h2>
          <span class="sub">{{ t('workbench.checklistSub') }}</span>
        </div>
        <div class="panel-body checklist">
          <div v-for="c in checklist" :key="c.label" class="check" :class="{ done: c.done }">
            <AppIcon :name="c.done ? 'checkCircle' : 'clock'" :size="15" />
            <span>{{ c.label }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.hello {
  display: flex; align-items: center; gap: 14px;
  padding: 22px 24px;
  background:
    radial-gradient(420px 180px at 8% 0%, color-mix(in srgb, var(--primary) 12%, transparent), transparent),
    var(--bg-card);
}
.hello h1 { font-size: 19px; font-weight: 700; }
.hello p { margin-top: 6px; font-size: 12.5px; color: var(--fg-muted); }
.hello__badge {
  margin-left: auto; flex: none;
  font-family: var(--font-mono); font-size: 11.5px;
}

.stats {
  margin-top: 14px;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
}
.stat { display: flex; align-items: center; gap: 13px; padding: 16px 18px; }
.stat__icon {
  width: 38px; height: 38px; border-radius: 11px;
  display: flex; align-items: center; justify-content: center;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 9%, transparent);
}
.stat b { display: block; font-size: 19px; font-family: var(--font-mono); }
.stat span { font-size: 11.5px; color: var(--fg-muted); }

.grid {
  margin-top: 14px;
  display: grid; grid-template-columns: 1.6fr 1fr; gap: 14px;
  align-items: start;
}

.entries {
  display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px;
}
.entry {
  position: relative;
  display: flex; flex-direction: column; align-items: flex-start; gap: 6px;
  padding: 14px 14px 12px;
  background: var(--bg-input);
  border: 1px solid transparent; border-radius: var(--radius-ctl);
  cursor: pointer; font-family: inherit;
  transition: all var(--ease);
  text-align: left;
}
.entry:hover {
  background: var(--bg-card);
  border-color: color-mix(in srgb, var(--primary) 30%, transparent);
  transform: translateY(-2px);
  box-shadow: 0 6px 18px rgba(16, 16, 20, 0.08);
}
.entry__icon { color: var(--primary); }
.entry b { font-size: 13px; color: var(--fg); }
.entry__group { font-size: 11px; color: var(--fg-muted); }
.entry.stub { opacity: 0.62; }
.entry__badge {
  position: absolute; top: 9px; right: 9px;
  margin: 0;
  font-size: 10px; line-height: 16px;
}

.checklist { display: grid; gap: 4px; }
.check {
  display: flex; align-items: center; gap: 9px;
  padding: 7px 8px; border-radius: 8px;
  font-size: 12.5px; color: var(--fg-muted);
}
.check.done { color: var(--fg-sub); }
.check.done :deep(svg) { color: var(--sev-low); }
.check :deep(svg) { color: var(--fg-muted); flex: none; }

@media (max-width: 1100px) {
  .grid { grid-template-columns: 1fr; }
  .stats { grid-template-columns: repeat(2, 1fr); }
  .entries { grid-template-columns: repeat(2, 1fr); }
}
</style>
