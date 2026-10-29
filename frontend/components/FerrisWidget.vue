<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import { useI18n } from '../i18n'

const props = defineProps<{ domains: string[] }>()
const isSpeaking = ref(false)
const { t } = useI18n()
const messageIndex = ref(0)
const messageDomain = ref('cf-mail.com')
const messages = [
    'Maybe you could give me a',
    'You know, I can use Vue and TypeScript now. Because I am a crab?',
    'Is your password too simple? Time to change it?',
    'I wanted to write this in Rust, but Cloudflare has not finished the Rust APIs yet.',
    'The domain {domain} could buy me a nice Thursday lunch.',
] as const
const currentMessage = computed(() => t(messages[messageIndex.value] || messages[0], { domain: messageDomain.value }))
const showStars = ref(false)
let timeout: ReturnType<typeof setTimeout> | undefined

function speak() {
    if (timeout) clearTimeout(timeout)
    messageDomain.value = props.domains[Math.floor(Math.random() * props.domains.length)] || 'cf-mail.com'
    const index = Math.floor(Math.random() * messages.length)
    messageIndex.value = index
    showStars.value = index === 0
    isSpeaking.value = true
    timeout = setTimeout(() => { isSpeaking.value = false }, 4000)
}
onUnmounted(() => { if (timeout) clearTimeout(timeout) })
</script>

<template>
    <div class="ferris-container">
        <div class="speech-bubble" :class="{ active: isSpeaking }" aria-live="polite">
            <span>{{ currentMessage }}</span>
            <template v-if="showStars">
                <a href="https://github.com/lino0n/cf-mail" target="_blank" rel="noopener noreferrer"
                    class="text-blue-500 underline font-bold">{{ t('star') }}</a>
            </template>
        </div>
        <button type="button" :title="t('Talk to Ferris')" @click="speak">
            <img src="/ferris.png" alt="Ferris" class="ferris-img">
        </button>
    </div>
</template>
