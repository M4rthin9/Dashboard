<script lang="ts">
  let {
    label,
    type = 'text',
    placeholder,
    value,
    oninput,
    disabled = false,
    required = false,
    autocomplete,
    'aria-label': ariaLabel,
  }: {
    label?: string;
    type?: 'text' | 'password' | 'email' | 'search' | 'date' | 'number';
    placeholder?: string;
    value?: string;
    oninput?: (e: Event & { currentTarget: HTMLInputElement }) => void;
    disabled?: boolean;
    required?: boolean;
    autocomplete?: HTMLInputElement['autocomplete'];
    'aria-label'?: string;
  } = $props();

  let inputId = 'inp-' + Math.random().toString(36).slice(2, 9);
</script>

<div class="flex flex-col gap-1.5">
  {#if label}
    <label for={inputId} class="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
  {/if}
  <input
    id={inputId}
    {type}
    {placeholder}
    {value}
    {oninput}
    {disabled}
    {required}
    {autocomplete}
    aria-label={ariaLabel}
    class="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2 text-sm text-slate-900 placeholder:text-slate-400 transition-colors duration-150 focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600/20 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:placeholder:text-slate-500"
  />
</div>
