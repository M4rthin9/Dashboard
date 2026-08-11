<script lang="ts">
  import type { Snippet } from 'svelte';
  import { Loader2 } from '@lucide/svelte';

  let {
    variant = 'primary',
    size = 'md',
    type = 'button',
    disabled = false,
    loading = false,
    fullWidth = false,
    onclick,
    children,
  }: {
    variant?: 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
    size?: 'sm' | 'md' | 'lg';
    type?: 'button' | 'submit' | 'reset';
    disabled?: boolean;
    loading?: boolean;
    fullWidth?: boolean;
    onclick?: (e: MouseEvent) => void;
    children: Snippet;
  } = $props();

  const variants: Record<string, string> = {
    primary:
      'bg-blue-700 text-white hover:bg-blue-800 focus-visible:outline-blue-700',
    secondary:
      'bg-slate-800 text-white hover:bg-slate-900 focus-visible:outline-slate-800 dark:bg-slate-200 dark:text-slate-900 dark:hover:bg-white',
    outline:
      'border border-slate-300 text-slate-700 hover:bg-slate-50 focus-visible:outline-slate-400 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800',
    danger:
      'bg-red-600 text-white hover:bg-red-700 focus-visible:outline-red-600',
    ghost:
      'text-slate-600 hover:bg-slate-100 focus-visible:outline-slate-400 dark:text-slate-300 dark:hover:bg-slate-800',
  };

  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-xs',
    md: 'px-4 py-2 text-sm',
    lg: 'px-5 py-2.5 text-base',
  };
</script>

<button
  {type}
  {onclick}
  {disabled}
  class="inline-flex items-center justify-center gap-2 rounded-xl font-medium transition-all duration-150 ease-in-out focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-60 {variants[variant]} {sizes[size]} {fullWidth ? 'w-full' : ''}"
>
  {#if loading}
    <Loader2 class="h-4 w-4 animate-spin" />
  {/if}
  {@render children()}
</button>
