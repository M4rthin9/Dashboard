<script lang="ts">
  let { title, description }: { title: string; description: string } = $props();
</script>

<div class="flex min-h-[60vh] items-center justify-center">
  <div class="max-w-md text-center">
    <h2 class="text-xl font-semibold text-slate-900 dark:text-slate-100">{title}</h2>
    <p class="mt-2 text-sm text-slate-500 dark:text-slate-400">{description}</p>
  </div>
</div>
