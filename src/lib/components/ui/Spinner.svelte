<script lang="ts">
  let { size = 'md' }: { size?: 'sm' | 'md' | 'lg' } = $props();

  const sizes: Record<string, string> = {
    sm: 'h-4 w-4 border-2',
    md: 'h-6 w-6 border-2',
    lg: 'h-10 w-10 border-4',
  };
</script>

<span
  class="inline-block animate-spin rounded-full border-slate-300 border-t-indigo-600 {sizes[size]}"
  role="status"
  aria-label="กำลังโหลด"
></span>
