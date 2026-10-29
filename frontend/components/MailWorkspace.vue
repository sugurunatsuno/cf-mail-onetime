<script setup lang="ts">
import { watch } from 'vue'
import { useI18n } from '../i18n'
import { useMailContext } from '../composables/useMailApp'
const app = useMailContext()
const { t } = useI18n()
const checked = (event: Event) => (event.target as HTMLInputElement).checked
watch(() => app.selectedMessage?.id, () => { app.imagePreview = null })
</script>

<template>
<!-- Main Dashboard -->
    <div v-show="app.isLoggedIn" class="h-full flex flex-col">

        <!-- Navbar -->
        <header
            class="bg-white border-b border-gray-200 h-28 lg:h-16 flex items-start pt-4 lg:pt-0 lg:items-center justify-between px-4 lg:px-6 flex-shrink-0 z-10">
            <div class="flex items-center gap-3">
                <div class="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center">
                    <i class="ph ph-envelope-open text-lg"></i>
                </div>
                <h1 class="text-lg font-bold text-gray-800 tracking-tight">{{ t('CF Post Office') }}</h1>
            </div>
            <div class="flex items-center gap-4">
            </div>
        </header>

        <!-- Content Area -->
        <div class="flex-1 flex overflow-hidden">

            <!-- Sidebar: Mailboxes -->
            <aside class="w-full lg:w-64 bg-white border-r border-gray-200 flex-col flex-shrink-0"
                :class="app.selectedMailbox ? 'hidden lg:flex' : 'flex'">
                <div class="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
                    <h2 class="text-xs font-bold text-gray-500 uppercase tracking-wider">{{ t('Mailboxes') }}</h2>
                    <button @click="app.showCreateModal = true"
                        class="btn btn-secondary btn-icon btn-sm"
                        :title="t('New Mailbox')">
                        <i class="ph ph-plus-circle text-xl"></i>
                    </button>
                </div>

                <!-- Search -->
                <div class="px-2 pt-2">
                    <div class="relative">
                        <i class="ph ph-magnifying-glass absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 text-sm"></i>
                        <input type="text" v-model="app.searchQuery" :placeholder="t('Search...')"
                            class="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-blue-500 outline-none">
                    </div>
                </div>

                <div class="overflow-y-auto flex-1 p-2 space-y-1">
                    <template v-for="box in app.filteredMailboxes" :key="box.id">
                        <div @click="app.selectMailbox(box)"
                            class="group flex items-center justify-between p-2.5 rounded-lg cursor-pointer transition text-sm relative"
                            :class="app.selectedMailbox?.id === box.id ? 'bg-blue-50 text-blue-700' : 'text-gray-700 hover:bg-gray-100'">

                            <div class="flex items-center gap-3 overflow-hidden">
                                <i class="ph text-lg"
                                    :class="app.selectedMailbox?.id === box.id ? 'ph-envelope-open text-blue-500' : 'ph-envelope text-gray-400'"></i>
                                <span class="truncate font-medium" v-text="box.address"></span>
                                <span v-show="box.is_auto_created" class="text-xs bg-orange-100 text-orange-600 px-1 rounded">{{ t('Auto') }}</span>
                            </div>

                            <div class="flex items-center gap-1 opacity-100 lg:opacity-0 lg:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                <button @click.stop="app.copyToClipboard(box.address)"
                                    class="btn btn-ghost btn-icon btn-sm" :title="t('Copy Address')">
                                    <i class="ph ph-copy"></i>
                                </button>
                                <button @click.stop="app.deleteMailbox(box.id)"
                                    class="btn btn-danger btn-icon btn-sm" :title="t('Delete Mailbox')">
                                    <i class="ph ph-trash"></i>
                                </button>
                            </div>
                        </div>
                    </template>

                    <div v-show="app.filteredMailboxes.length === 0 && !app.isLoading" class="text-center py-8 text-gray-400 text-sm">
                        <span v-show="app.searchQuery">{{ t('No results') }}</span>
                        <span v-show="!app.searchQuery">{{ t('No mailboxes yet.') }}</span>
                    </div>
                </div>
            </aside>

            <!-- Middle: Message List -->
            <div class="w-full lg:w-80 bg-white border-r border-gray-200 flex-col flex-shrink-0" v-if="app.selectedMailbox"
                :class="app.selectedMessage || app.isLoadingContent ? 'hidden lg:flex' : 'flex'">
                <div class="p-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/50 h-[57px]">
                    <button type="button" :title="t('Back to mailboxes')" @click="app.selectedMailbox = null"
                        class="btn btn-ghost btn-icon btn-sm lg:hidden mr-2">
                        <i class="ph ph-arrow-left text-xl"></i>
                    </button>
                    <h3 class="font-semibold text-gray-800 truncate pr-2" v-text="app.selectedMailbox?.address"></h3>
                    <button :title="t('Refresh messages')" @click="app.fetchMessages(app.selectedMailbox.id)"
                        class="btn btn-ghost btn-icon btn-sm">
                        <i class="ph ph-arrow-clockwise text-lg" :class="{'animate-spin': app.isLoadingMessages}"></i>
                    </button>
                </div>

                <div v-show="app.messages.length > 0" class="px-4 py-2 border-b border-gray-100 bg-white flex flex-wrap items-center justify-between gap-2">
                    <label class="flex items-center gap-2 text-xs text-gray-600">
                        <input type="checkbox" class="rounded border-gray-300"
                            :checked="app.allMessagesSelected"
                            @change="app.toggleAllMessages(checked($event))">
                        <span v-text="app.selectedMessageIds.length ? t('{count} selected', { count: app.selectedMessageIds.length }) : t('Select messages')"></span>
                    </label>

                    <div class="flex items-center gap-2" v-show="app.selectedMessageIds.length > 0">
                        <button @click="app.batchMarkMessagesRead"
                            class="btn btn-secondary btn-sm">
                            {{ t('Mark Read') }}
                        </button>
                        <button @click="app.batchDeleteMessages"
                            class="btn btn-danger btn-sm">
                            {{ t('Delete') }}
                        </button>
                    </div>
                </div>

                <div class="overflow-y-auto flex-1">
                    <template v-for="msg in app.messages" :key="msg.id">
                        <div @click="app.selectMessage(msg.id)"
                            class="p-4 border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition"
                            :class="{'bg-blue-50/60': app.selectedMessage?.id === msg.id, 'bg-white': app.selectedMessage?.id !== msg.id}">
                            <div class="flex justify-between items-start gap-2 mb-1">
                                <div class="flex items-start gap-2 min-w-0 flex-1">
                                    <input type="checkbox" class="mt-0.5 rounded border-gray-300"
                                        :checked="app.selectedMessageIds.includes(msg.id)"
                                        @click.stop
                                        @change="app.toggleMessageSelection(msg.id, checked($event))">
                                    <span class="font-semibold text-gray-900 text-sm truncate"
                                        v-text="msg.sender || t('Unknown')"></span>
                                </div>
                                <span class="text-xs text-gray-500 whitespace-nowrap"
                                    v-text="app.formatDate(msg.received_at)"></span>
                            </div>
                            <div class="text-sm text-gray-800 font-medium truncate mb-1"
                                :class="{'text-gray-600 font-normal': msg.is_read}"
                                v-text="msg.subject || t('(No Subject)')"></div>

                            <!-- Quick Copy Verification Code -->
                            <div v-show="msg.verification_code" class="flex items-center gap-2 mb-1">
                                <span
                                    class="bg-blue-100/50 text-blue-700 text-xs px-1.5 py-0.5 rounded font-mono font-bold border border-blue-100"
                                    v-text="msg.verification_code"></span>
                                <button @click.stop="app.copyToClipboard(msg.verification_code)"
                                    class="btn btn-ghost btn-icon btn-sm"
                                    :title="t('Copy Code')">
                                    <i class="ph ph-copy"></i>
                                </button>
                            </div>
                            <div class="text-xs text-gray-500 truncate" v-text="msg.preview || t('No preview available')">
                            </div>
                        </div>
                    </template>
                    <div v-show="app.messages.length === 0 && !app.isLoadingMessages"
                        class="text-center py-12 text-gray-400 text-sm px-6">
                        <div class="mb-2"><i class="ph ph-tray text-3xl"></i></div>
                        {{ t('No messages in this mailbox.') }}
                    </div>
                </div>
            </div>

            <!-- Empty State for Message List -->
            <div class="flex-1 hidden lg:flex items-center justify-center bg-gray-50 text-gray-400 flex-col"
                v-show="!app.selectedMailbox">
                <template v-if="app.mailboxes.length === 0">
                    <div class="max-w-md bg-white border border-gray-200 rounded-2xl shadow-sm p-6 text-left text-gray-600">
                        <div class="flex items-center gap-3 mb-4">
                            <div class="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                <i class="ph ph-signpost text-xl"></i>
                            </div>
                            <div>
                                <h3 class="text-base font-semibold text-gray-900">{{ t('Getting started') }}</h3>
                                <p class="text-sm text-gray-500">{{ t('Create your first full email address. Its domain will then appear in the dropdown.') }}</p>
                            </div>
                        </div>

                        <ol class="space-y-2 text-sm list-decimal list-inside">
                            <li>{{ t('Point Catch-all to this Worker in Cloudflare Email Routing.') }}</li>
                            <li>{{ t('Click the button below and enter a full email address, for example:') }} <code class="bg-gray-100 px-1 rounded">support@example.com</code></li>
                            <li>{{ t('Once created, the domain is saved so you can generate more addresses with it.') }}</li>
                        </ol>

                        <button @click="app.showCreateModal = true"
                            class="btn btn-primary mt-5 w-full">
                            {{ t('Create your first mailbox') }}
                        </button>
                    </div>
                </template>

                <template v-if="app.mailboxes.length > 0">
                    <div class="flex items-center justify-center flex-col">
                        <i class="ph ph-sidebar text-4xl mb-3"></i>
                        <p>{{ t('Select a mailbox to view messages') }}</p>
                    </div>
                </template>
            </div>

            <!-- Right: Message Detail -->
            <main class="flex-1 min-w-0 flex flex-col bg-white overflow-hidden relative" v-if="app.selectedMessage || app.isLoadingContent">
                <template v-if="app.selectedMessage">
                <!-- Toolbar -->
                <div
                    class="h-[57px] border-b border-gray-200 flex items-center justify-between px-6 bg-white flex-shrink-0">
                    <div class="flex items-center gap-3">
                        <button :title="t('Back to messages')" @click="app.selectedMessage = null" class="btn btn-ghost btn-icon btn-sm lg:hidden">
                            <i class="ph ph-arrow-left text-xl"></i>
                        </button>
                        <div class="flex gap-2">
                            <!-- Actions could go here -->
                        </div>
                    </div>
                    <button @click="app.deleteMessage(app.selectedMessage.id)"
                        class="btn btn-danger btn-sm">
                        <i class="ph ph-trash text-lg"></i> {{ t('Delete') }}
                    </button>
                </div>

                <!-- Reading Pane -->
                <div class="flex-1 overflow-y-auto" v-show="!app.isLoadingContent">
                    <div class="p-6 pb-2">
                        <div class="flex flex-col items-start gap-3 lg:flex-row lg:items-center lg:justify-between mb-4">
                            <h2 class="min-w-0 break-words text-xl font-bold text-gray-900"
                                v-text="app.selectedMessage?.subject || t('(No Subject)')"></h2>

                            <div v-show="app.selectedMessage?.verification_code"
                                class="flex flex-shrink-0 items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg border border-blue-100">
                                <span class="text-xs text-blue-600 font-semibold uppercase tracking-wider">{{ t('Code:') }}</span>
                                <span class="text-lg font-mono font-bold text-blue-700"
                                    v-text="app.selectedMessage?.verification_code"></span>
                                <button @click="app.copyToClipboard(app.selectedMessage?.verification_code)"
                                    class="btn btn-ghost btn-icon btn-sm" :title="t('Copy Code')">
                                    <i class="ph ph-copy"></i>
                                </button>
                            </div>
                        </div>

                        <div class="flex flex-col items-start gap-3 lg:flex-row lg:justify-between mb-6">
                            <div class="flex min-w-0 items-center gap-3">
                                <div
                                    class="w-10 h-10 flex-shrink-0 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-lg">
                                    <span v-text="(app.selectedMessage?.sender || '?')[0].toUpperCase()"></span>
                                </div>
                                <div class="min-w-0 break-words">
                                    <div class="text-sm font-bold text-gray-900">
                                        <span v-text="app.selectedMessage?.sender"></span>
                                    </div>
                                    <div class="text-xs text-gray-500"
                                        v-text="t('To: {address}', { address: app.selectedMessage?.mailbox_address || t('Me') })"></div>
                                </div>
                            </div>
                            <div class="text-sm text-gray-500 lg:flex-shrink-0 lg:text-right" v-text="app.formatFullDate(app.selectedMessage?.received_at)">
                            </div>
                        </div>

                        <!-- Attachments -->
                        <div v-show="(app.selectedMessage.attachments?.length || 0) > 0" class="flex flex-wrap gap-2 mb-6">
                            <template v-for="att in app.selectedMessage?.attachments" :key="att.id">
                                <a :href="'/api/attachments/' + att.id" target="_blank"
                                    class="btn btn-secondary">
                                    <i class="ph ph-paperclip"></i>
                                    <span v-text="att.filename" class="truncate max-w-[150px]"></span>
                                    <span class="text-xs text-gray-400" v-text="app.formatSize(att.size)"></span>
                                </a>
                                <button v-if="att.content_type?.startsWith('image/')"
                                    type="button" @click="app.openImagePreview('/api/attachments/' + att.id)"
                                    :title="t('Preview {name}', { name: att.filename })"
                                    class="btn btn-secondary btn-sm">
                                    {{ t('Preview image') }}
                                </button>
                            </template>
                        </div>
                    </div>

                    <div class="border-t border-gray-200">
                        <!-- Email Content Frame -->
                        <div class="w-full h-full min-h-[500px] bg-white">
                            <template v-if="app.selectedMessage">
                                <iframe :title="t('Email content')" class="w-full h-full min-h-[600px] border-none"
                                    sandbox="allow-popups allow-popups-to-escape-sandbox"
                                    :srcdoc="app.selectedMessage.safe_html"></iframe>
                            </template>
                        </div>
                    </div>

                    <!-- Raw EML Link -->
                    <div class="p-6 pt-2 text-right">
                        <a :href="'/api/messages/' + app.selectedMessage?.id + '/raw'" target="_blank"
                            class="btn btn-secondary btn-sm">{{ t('View Raw EML') }}</a>
                    </div>
                </div>

                </template>
                <div v-show="app.isLoadingContent" role="status" :aria-label="t('Loading message')" class="absolute inset-0 flex items-center justify-center bg-white z-20">
                    <i class="ph ph-spinner animate-spin text-3xl text-blue-500"></i>
                </div>
            </main>

            <!-- Empty State for Details -->
            <div class="flex-1 hidden lg:flex items-center justify-center bg-gray-50 text-gray-400 flex-col"
                v-show="app.selectedMailbox && !app.selectedMessage && !app.isLoadingContent">
                <i v-if="app.isLoadingContent" class="ph ph-spinner animate-spin text-3xl text-blue-500" :aria-label="t('Loading message')"></i>
                <template v-else>
                    <i class="ph ph-envelope-open text-4xl mb-3 opacity-50"></i>
                    <p>{{ t('Select a message to read') }}</p>
                </template>
            </div>
        </div>
    </div>
</template>
