<script lang="ts">
  import { MessageCircle, X, Send, Bot, User, Loader2 } from '@lucide/svelte';
  import { chatCompletion, type ChatMessage } from '../../utils/chatApi';

  let {
    systemPrompt,
    title = 'ผู้ช่วย AI',
    subtitle = 'ถามได้เลย',
    placeholder = 'พิมพ์คำถาม...',
  }: {
    systemPrompt: string;
    title?: string;
    subtitle?: string;
    placeholder?: string;
  } = $props();

  let open = $state(false);
  let input = $state('');
  let sending = $state(false);
  let messages = $state<ChatMessage[]>([]);
  let scrollEl = $state<HTMLDivElement>();

  $effect(() => {
    if (scrollEl && messages.length > 0) {
      scrollEl.scrollTop = scrollEl.scrollHeight;
    }
  });

  async function send() {
    const text = input.trim();
    if (!text || sending) return;

    input = '';
    messages = [...messages, { role: 'user', content: text }];
    sending = true;

    const result = await chatCompletion([
      { role: 'system', content: systemPrompt },
      ...messages,
    ]);

    sending = false;

    if (result.error) {
      messages = [...messages, { role: 'assistant', content: `⚠️ ${result.error}` }];
    } else if (result.reply) {
      messages = [...messages, { role: 'assistant', content: result.reply }];
    }
  }

  function handleKeydown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function clearChat() {
    messages = [];
  }
</script>

<!-- Floating button -->
<button
  class="fixed bottom-20 right-5 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-blue-700 text-white shadow-lg shadow-blue-900/30 transition-all duration-200 hover:bg-blue-800 hover:shadow-xl focus-visible:outline-2 focus-visible:outline-blue-700 focus-visible:outline-offset-2 lg:bottom-6 dark:bg-blue-600 dark:hover:bg-blue-500 {open ? 'scale-0 opacity-0' : 'scale-100 opacity-100'}"
  onclick={() => (open = true)}
  aria-label="เปิดแชท"
>
  <MessageCircle class="h-6 w-6" />
</button>

<!-- Chat panel -->
{#if open}
  <div class="fixed bottom-20 right-5 z-50 flex w-[360px] max-w-[calc(100vw-2.5rem)] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-black/15 transition-all duration-200 lg:bottom-6 dark:border-slate-700 dark:bg-slate-900">
    <!-- Header -->
    <div class="flex items-center justify-between bg-gradient-to-r from-blue-700 to-blue-800 px-4 py-3 text-white dark:from-blue-600 dark:to-blue-700">
      <div class="flex items-center gap-2.5">
        <div class="flex h-8 w-8 items-center justify-center rounded-lg bg-white/20">
          <Bot class="h-4.5 w-4.5" />
        </div>
        <div>
          <p class="text-sm font-semibold">{title}</p>
          <p class="text-[11px] text-white/70">{subtitle}</p>
        </div>
      </div>
      <div class="flex items-center gap-1">
        {#if messages.length > 0}
          <button
            class="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
            onclick={clearChat}
            title="ล้างแชท"
          >
            <svg class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" /></svg>
          </button>
        {/if}
        <button
          class="rounded-lg p-1.5 text-white/70 transition-colors hover:bg-white/15 hover:text-white"
          onclick={() => (open = false)}
          aria-label="ปิดแชท"
        >
          <X class="h-4.5 w-4.5" />
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div bind:this={scrollEl} class="flex-1 overflow-y-auto px-4 py-3" style="min-height: 280px; max-height: 420px;">
      {#if messages.length === 0}
        <div class="flex h-full flex-col items-center justify-center text-center">
          <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/50">
            <Bot class="h-6 w-6 text-blue-600 dark:text-blue-400" />
          </div>
          <p class="mt-3 text-sm font-medium text-slate-700 dark:text-slate-200">สวัสดี! มีอะไรให้ช่วย?</p>
          <p class="mt-1 text-xs text-slate-400 dark:text-slate-500">พิมพ์คำถามได้เลย</p>
        </div>
      {:else}
        <div class="flex flex-col gap-3">
          {#each messages as msg (msg)}
            <div class="flex {msg.role === 'user' ? 'justify-end' : 'justify-start'}">
              <div class="flex max-w-[85%] items-end gap-2 {msg.role === 'user' ? 'flex-row-reverse' : ''}">
                {#if msg.role === 'assistant'}
                  <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                    <Bot class="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                  </div>
                {:else}
                  <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 dark:bg-slate-700">
                    <User class="h-3.5 w-3.5 text-slate-600 dark:text-slate-300" />
                  </div>
                {/if}
                <div class="rounded-2xl px-3.5 py-2 text-sm leading-relaxed {msg.role === 'user'
                  ? 'bg-blue-700 text-white dark:bg-blue-600'
                  : 'bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-200'}">
                  {msg.content}
                </div>
              </div>
            </div>
          {/each}

          {#if sending}
            <div class="flex justify-start">
              <div class="flex items-end gap-2">
                <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-950">
                  <Bot class="h-3.5 w-3.5 text-blue-700 dark:text-blue-400" />
                </div>
                <div class="flex items-center gap-1 rounded-2xl bg-slate-100 px-4 py-2.5 dark:bg-slate-800">
                  <Loader2 class="h-3.5 w-3.5 animate-spin text-slate-400" />
                  <span class="text-xs text-slate-400">กำลังคิด...</span>
                </div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>

    <!-- Input -->
    <div class="border-t border-slate-100 px-3 py-2.5 dark:border-slate-800">
      <div class="flex items-end gap-2">
        <textarea
          bind:value={input}
          onkeydown={handleKeydown}
          {placeholder}
          rows="1"
          class="max-h-20 min-h-[36px] flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 transition-colors focus:border-blue-400 focus:outline-none focus:ring-1 focus:ring-blue-400 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:placeholder-slate-500 dark:focus:border-blue-500"
        ></textarea>
        <button
          class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white transition-colors hover:bg-blue-800 disabled:opacity-40 dark:bg-blue-600 dark:hover:bg-blue-500"
          onclick={send}
          disabled={!input.trim() || sending}
          aria-label="ส่ง"
        >
          <Send class="h-4 w-4" />
        </button>
      </div>
    </div>
  </div>
{/if}
