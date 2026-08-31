<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import { useUserStore } from '@/stores/user'
import { useMenuStore, type FlatMenuItem } from '@/stores/menu'
import AppIcon from '@/components/AppIcon.vue'

const router = useRouter()
const userStore = useUserStore()
const menuStore = useMenuStore()

const greeting = computed(() => {
  const h = new Date().getHours()
  if (h < 5) return '夜深了'
  if (h < 11) return '早上好'
  if (h < 13) return '中午好'
  if (h < 18) return '下午好'
  return '晚上好'
})

const today = new Date().toLocaleDateString('zh-CN', {
  year: 'numeric', month: 'long', day: 'numeric', weekday: 'long',
})

const stats = [
  { icon: 'zap', label: '内置工具', value: '6' },
  { icon: 'activity', label: '日志样本', value: '1,284' },
  { icon: 'syslog', label: '累计发包', value: '3,208' },
  { icon: 'assets', label: '知识条目', value: '12' },
]

/** 第 1 周验证清单：交付自检用，后续迭代替换为迭代看板 */
const checklist = [
  { label: 'pnpm monorepo + catalog 统一依赖版本', done: true },
  { label: '@aegis/contract 契约包（基座/子应用共享类型与常量）', done: true },
  { label: '基座登录 + 动态菜单（mock 数据，api 层可平滑换真实接口）', done: true },
  { label: '主题系统：7 主题色 × 明暗 × 跟随系统 × 三种导航布局', done: true },
  { label: 'TagsView 多标签：切换 / 关闭 / 右键菜单 / 子应用着色', done: true },
  { label: 'Vite 子应用 micro-app iframe 沙箱装载（切到 Syslog 发包器验证）', done: true },
  { label: 'Syslog 发包器：模板渲染 + 模拟发送（在子应用页面操作）', done: true },
  { label: '后端接口与数据库（第 2 周起接入，当前全 mock）', done: false },
]

function go(item: FlatMenuItem): void {
  router.push(item.path)
}
</script>

<template>
  <div class="workbench">
    <!-- 问候横幅 -->
    <section class="hello panel">
      <div class="hello__main">
        <h1>{{ greeting }}，{{ userStore.userInfo?.nickname || '同学' }}</h1>
        <p>{{ today }} · MVP 第 1 周验证版：微前端骨架 + 主题系统 + 第一个 SOC 工具已就位，后端尚未接入。</p>
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
          <h2>快捷入口</h2>
          <span class="sub">点击直达 · 灰色项后续迭代开放</span>
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
            <b>{{ item.title }}</b>
            <span class="entry__group">{{ item.groupTitle }}</span>
            <a-tag v-if="item.stub" class="entry__badge">建设中</a-tag>
          </button>
        </div>
      </section>

      <!-- 验证清单 -->
      <section class="panel">
        <div class="panel-head">
          <AppIcon name="checkCircle" :size="15" />
          <h2>第 1 周验证清单</h2>
          <span class="sub">对照方案文档 §7 MVP 计划</span>
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
  padding: 3px 11px; border-radius: 12px;
  font-family: var(--font-mono); font-size: 11.5px;
  color: var(--primary);
  background: color-mix(in srgb, var(--primary) 8%, transparent);
  border: 1px solid color-mix(in srgb, var(--primary) 22%, transparent);
}

.stats {
  margin-top: 14px;
  display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px;
}
.stat { display: flex; align-items: center; gap: 13px; padding: 16px 18px; }
.stat__icon {
  width: 38px; height: 38px; border-radius: 11px;
  display: grid; place-items: center;
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
  padding: 0 6px; border-radius: 8px;
  font-size: 10px; line-height: 16px;
  color: var(--fg-muted);
  background: var(--bg-card);
  border: 1px solid var(--border-strong);
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
