<script setup lang="ts">
import { useI18n } from '../i18n'
import { useMailContext } from '../composables/useMailApp'
const app = useMailContext()
const { t, locale, setLocale } = useI18n()
function changeLanguage(event: Event) {
    const value = (event.target as HTMLSelectElement).value
    if (value === 'zh-CN' || value === 'en') setLocale(value)
}
</script>

<template>
<!-- Footer -->
    <!-- Social Buttons (Dynamic Position) -->
    <div class="fixed transition-opacity duration-200 z-50 flex items-center gap-1 lg:gap-3 whitespace-nowrap"
        :class="app.isLoggedIn ? 'top-16 right-2 lg:top-4 lg:right-6 transform translate-x-0' : 'bottom-4 left-1/2 transform -translate-x-1/2'">
        <select :value="locale" @change="changeLanguage" aria-label="Language / 语言"
            class="btn btn-secondary btn-sm pointer-events-auto">
            <option value="zh-CN">中文</option>
            <option value="en">English</option>
        </select>
        <a aria-label="GitHub" title="GitHub" href="https://github.com/lino0n/cf-mail" target="_blank"
            class="btn btn-secondary btn-sm pointer-events-auto">
            <i class="ph ph-github-logo text-lg"></i> <span class="hidden sm:inline">GitHub</span>
        </a>
        <a aria-label="LinuxDO" title="LinuxDO" href="https://linux.do/u/marre/summary" target="_blank"
            class="btn btn-secondary btn-sm pointer-events-auto">
            <i class="ph ph-linux-logo text-lg"></i> <span class="hidden sm:inline">LinuxDO</span>
        </a>
        <button @click="app.fetchSettings(); app.showSettingsModal = true" v-show="app.isLoggedIn"
            class="btn btn-secondary btn-sm pointer-events-auto">
            <i class="ph ph-gear text-lg"></i> {{ t('Settings') }}
        </button>
        <button @click="app.logout" v-show="app.isLoggedIn"
            class="btn btn-secondary btn-sm pointer-events-auto">
            <i class="ph ph-sign-out text-lg"></i> {{ t('Logout') }}
        </button>
    </div>
</template>
