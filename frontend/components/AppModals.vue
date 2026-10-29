<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import { useMailContext } from '../composables/useMailApp'
import { useI18n } from '../i18n'
const { t } = useI18n()
const app = useMailContext()
const inputValue = (event: Event) => (event.target as HTMLInputElement).value
const onKeydown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') app.imagePreview = null
}
onMounted(() => {
    window.addEventListener('keydown', onKeydown)
    window.addEventListener('mousemove', app.onDrag)
    window.addEventListener('mouseup', app.stopDrag)
    window.addEventListener('blur', app.stopDrag)
})
onUnmounted(() => {
    window.removeEventListener('keydown', onKeydown)
    window.removeEventListener('mousemove', app.onDrag)
    window.removeEventListener('mouseup', app.stopDrag)
    window.removeEventListener('blur', app.stopDrag)
})
</script>

<template>
<!-- Create Mailbox Modal -->
    <div v-show="app.showCreateModal" @click.self="app.showCreateModal = false"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
        <div
            class="bg-white rounded-xl shadow-2xl w-full max-w-sm p-6 transform transition-all">
            <h3 class="text-lg font-bold text-gray-900 mb-4">{{ t('Create New Mailbox') }}</h3>

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Custom Address (Optional)') }}</label>
                    <div class="flex" v-show="app.availableDomains.length > 0">
                        <input type="text" v-model="app.newMailboxAddress" :placeholder="t('e.g. support')"
                            class="flex-1 px-3 py-2 border border-gray-300 rounded-l-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm">
                        <div class="relative">
                            <select v-model="app.selectedDomain"
                                class="appearance-none bg-gray-100 border border-l-0 border-gray-300 px-3 py-2 pr-8 text-sm text-gray-500 rounded-r-lg h-full outline-none focus:ring-0 cursor-pointer">
                                <template v-for="domain in app.availableDomains" :key="domain">
                                    <option :value="domain" v-text="'@' + domain"></option>
                                </template>
                            </select>
                            <div
                                class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                                <i class="ph ph-caret-down text-xs"></i>
                            </div>
                        </div>
                    </div>
                    <input v-show="app.availableDomains.length === 0" type="text" v-model="app.newMailboxAddress" :placeholder="t('e.g. support@example.com')"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none text-sm">
                    <p class="text-xs text-gray-500 mt-1" v-show="app.availableDomains.length > 0">{{ t('Leave empty to generate a random address.') }}</p>
                    <p class="text-xs text-gray-500 mt-1" v-show="app.availableDomains.length === 0">{{ t('Enter a full email address first. After that, this domain will appear in the dropdown.') }}</p>
                </div>

                <div class="flex gap-3 mt-6">
                    <button @click="app.showCreateModal = false"
                        class="btn btn-secondary flex-1">{{ t('Cancel') }}</button>
                    <button :disabled="app.isCreating" @click="app.createMailbox"
                        class="btn btn-primary flex-1 relative">
                        <span v-show="!app.isCreating">{{ t('Create') }}</span>
                        <span v-show="app.isCreating"><i class="ph ph-spinner animate-spin"></i></span>
                    </button>
                </div>
            </div>
        </div>
    </div>

    <!-- Settings Modal -->
    <div v-show="app.showSettingsModal" @click.self="app.showSettingsModal = false"
        class="fixed inset-0 bg-black/50 z-50 flex items-center justify-center backdrop-blur-sm">
        <div
            class="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto p-6 transform transition-all">
            <h3 class="text-lg font-bold text-gray-900 mb-4">{{ t('Settings') }}</h3>

            <div class="space-y-4">
                <!-- Auto Create Toggle -->
                <div class="flex items-center justify-between">
                    <label class="text-sm font-medium text-gray-700">{{ t('Auto Create Mailbox') }}</label>
                    <button type="button" :aria-label="t('Auto Create Mailbox')" aria-describedby="auto-create-help"
                        :aria-pressed="app.settings.auto_create_enabled === 'true'"
                        @click="app.settings.auto_create_enabled = app.settings.auto_create_enabled === 'true' ? 'false' : 'true'"
                        class="toggle"
                        :class="app.settings.auto_create_enabled === 'true' ? 'bg-blue-600' : 'bg-gray-300'">
                        <span class="toggle-thumb"
                            :class="app.settings.auto_create_enabled === 'true' ? 'translate-x-6' : ''"></span>
                    </button>
                </div>

                <div id="auto-create-help" class="rounded-lg bg-blue-50/60 border border-blue-100 px-3 py-2.5 text-xs leading-relaxed text-slate-600 space-y-1.5">
                    <p>{{ t('On: The first email to a new address creates its mailbox automatically if the part before @ meets the length and starting-character rules below. Otherwise, the email is rejected.') }}</p>
                    <p>{{ t('Off: Create a mailbox manually before receiving mail. Emails to addresses without a mailbox are rejected. Existing mailboxes keep receiving mail in either mode.') }}</p>
                </div>

                <!-- Min Length -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Min Length') }}</label>
                    <input type="number" :value="app.settings.auto_create_min_length" @input="app.settings.auto_create_min_length = inputValue($event)" min="1" max="50"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                </div>

                <!-- Max Length -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Max Length') }}</label>
                    <input type="number" :value="app.settings.auto_create_max_length" @input="app.settings.auto_create_max_length = inputValue($event)" min="1" max="50"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                </div>

                <!-- Start Type -->
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Allowed Start Character') }}</label>
                    <select v-model="app.settings.auto_create_start_type"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                        <option value="both">{{ t('Letter or Digit') }}</option>
                        <option value="letter">{{ t('Letter Only') }}</option>
                        <option value="digit">{{ t('Digit Only') }}</option>
                    </select>
                </div>

                <!-- Telegram Settings -->
                <div class="pt-4 border-t border-gray-200">
                    <div class="flex items-center justify-between mb-3">
                        <h4 class="text-sm font-semibold text-gray-800">{{ t('Telegram Notification') }}</h4>
                        <button @click="app.tgEnabled = !app.tgEnabled"
                            class="toggle"
                            :class="app.tgEnabled ? 'bg-blue-600' : 'bg-gray-300'">
                            <span class="toggle-thumb"
                                :class="app.tgEnabled ? 'translate-x-6' : ''"></span>
                        </button>
                    </div>
                    <div v-show="app.tgEnabled" class="space-y-3">
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Bot Token') }} <span class="text-red-500">*</span></label>
                            <input type="password" v-model="app.settings.tg_bot_token" placeholder="123456:ABC-DEF..." required
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                            <p v-show="app.tgBotTokenConfigured" class="text-xs text-gray-500 mt-1">{{ t('Token is configured. It is hidden for security. Leave empty to keep the current value.') }}</p>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Chat ID') }} <span class="text-red-500">*</span></label>
                            <div class="flex gap-2">
                                <input type="text" v-model="app.settings.tg_chat_id" placeholder="-1001234567890" required
                                    class="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                                <button type="button" @click="app.fetchChatId" :disabled="!app.settings.tg_bot_token || app.fetchingChatId"
                                    class="btn btn-secondary">
                                    <span v-show="!app.fetchingChatId">{{ t('Fetch') }}</span>
                                    <span v-show="app.fetchingChatId">...</span>
                                </button>
                            </div>
                        </div>
                        <div>
                            <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Topic ID') }} <span class="text-gray-400 text-xs">{{ t('(Optional)') }}</span></label>
                            <input type="text" v-model="app.settings.tg_topic_id" placeholder="123"
                                class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                        </div>
                    </div>
                </div>

                <!-- Delete Auto Created -->
                <div class="pt-4 border-t border-gray-200">
                    <button @click="app.deleteAutoCreatedMailboxes"
                        class="btn btn-danger">
                        <i class="ph ph-trash"></i> {{ t('Delete All Auto-Created Mailboxes') }}
                    </button>
                </div>

                <div class="flex gap-3 mt-6">
                    <button @click="app.showSettingsModal = false"
                        class="btn btn-secondary flex-1">{{ t('Cancel') }}</button>
                    <button @click="app.saveSettings"
                        class="btn btn-primary flex-1">{{ t('Save') }}</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Force Password Change Modal -->
    <div v-show="app.passwordChangeRequired"
        class="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center backdrop-blur-sm">
        <div class="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
            <div class="flex items-center gap-3 mb-4">
                <div class="w-10 h-10 rounded-full bg-red-100 text-red-600 flex items-center justify-center">
                    <i class="ph ph-shield-warning text-xl"></i>
                </div>
                <div>
                    <h3 class="text-lg font-bold text-gray-900">{{ t('Change the default password') }}</h3>
                    <p class="text-sm text-gray-500">{{ t('The default administrator password is still in use. Change it before continuing.') }}</p>
                </div>
            </div>

            <div class="space-y-4">
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Current Password') }}</label>
                    <input type="password" v-model="app.passwordChangeForm.currentPassword"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('New Password') }}</label>
                    <input type="password" v-model="app.passwordChangeForm.newPassword"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                </div>
                <div>
                    <label class="block text-sm font-medium text-gray-700 mb-1">{{ t('Confirm New Password') }}</label>
                    <input type="password" v-model="app.passwordChangeForm.confirmPassword"
                        class="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm outline-none focus:ring-1 focus:ring-blue-500">
                </div>

                <div v-show="app.passwordChangeError" class="text-sm text-red-500" v-text="app.passwordChangeError"></div>

                <button @click="app.changePassword"
                    class="btn btn-primary w-full"
                    :disabled="app.changingPassword">
                    <span v-show="!app.changingPassword">{{ t('Save and Continue') }}</span>
                    <i v-show="app.changingPassword" class="ph ph-spinner animate-spin text-xl"></i>
                </button>
            </div>
        </div>
    </div>

    <!-- Image Preview Modal -->
    <div v-show="app.imagePreview"
        class="fixed inset-0 bg-black/70 z-50 flex items-center justify-center"
        @click.self="app.imagePreview = null">
        <div class="relative select-none"
            :style="`transform: translate(${app.imagePos.x}px, ${app.imagePos.y}px)`"
            @mousedown="app.startDrag($event)">
            <button :title="t('Close image preview')" @click="app.imagePreview = null"
                class="btn btn-secondary btn-icon btn-sm absolute -top-3 -right-3 z-10">
                <i class="ph ph-x text-lg"></i>
            </button>
            <img :src="app.imagePreview || undefined" :alt="t('Email image preview')" draggable="false" class="max-w-[90vw] max-h-[90vh] rounded-lg shadow-2xl cursor-move">
        </div>
    </div>
</template>
