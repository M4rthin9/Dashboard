<script lang="ts">
  let { value, onchange, options, label, placeholder = '', 'aria-label': ariaLabel }: {
    value: string;
    onchange: (value: string) => void;
    options: Array<{ value: string; label: string }>;
    label?: string;
    placeholder?: string;
    'aria-label'?: string;
  } = $props();

  let selectId = 'sel-' + Math.random().toString(36).slice(2, 9);
</script>

{#if label}
  <label for={selectId} class="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
{/if}
<select
  id={selectId}
  bind:value
  onchange={(e) => onchange((e.currentTarget as HTMLSelectElement).value)}
  aria-label={ariaLabel ?? label}
  class="rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100"
>
  {#if placeholder !== undefined}
    <option value="">{placeholder}</option>
  {/if}
  {#each options as o (o.value)}
    <option value={o.value}>{o.label}</option>
  {/each}
</select>
