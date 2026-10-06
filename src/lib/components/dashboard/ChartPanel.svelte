<script lang="ts">
  import type { EChartsOption } from 'echarts';
  import Card from '../ui/Card.svelte';
  import EChart from '../charts/EChart.svelte';
  let { title, description, option, columns, rows, empty = false, height = '290px' }: {
    title: string; description: string; option: EChartsOption;
    columns: string[]; rows: { label: string; values: (string | number)[] }[];
    empty?: boolean; height?: string;
  } = $props();
</script>

<Card {title} subtitle={description}>
  {#if empty}
    <div class="flex min-h-52 flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 text-center dark:bg-slate-800/40"><p class="text-sm text-slate-500">ไม่มีข้อมูลสำหรับแผนภูมิในช่วงที่เลือก</p><p class="text-xs text-slate-400">ลองเปลี่ยนช่วงวันที่หรือประเภทการจอง</p></div>
  {:else}
    <EChart {option} {height} label={`${title} · ${description}`} />
  {/if}
  <details class="mt-3 border-t border-slate-100 pt-3 dark:border-slate-800">
    <summary class="cursor-pointer text-xs font-medium text-slate-500 hover:text-blue-700 dark:text-slate-400">ดูข้อมูลในรูปแบบตาราง</summary>
    <div class="mt-3 max-h-64 overflow-auto">
      <table class="w-full text-left text-xs"><caption class="sr-only">{title}</caption><thead><tr>{#each columns as column (column)}<th scope="col" class="whitespace-nowrap border-b border-slate-200 px-2 py-2 font-medium text-slate-500 dark:border-slate-700">{column}</th>{/each}</tr></thead><tbody>{#each rows as row (row.label)}<tr><th scope="row" class="whitespace-nowrap border-b border-slate-100 px-2 py-2 font-normal text-slate-600 dark:border-slate-800 dark:text-slate-300">{row.label}</th>{#each row.values as value, index (index)}<td class="border-b border-slate-100 px-2 py-2 text-right tabular-nums text-slate-700 dark:border-slate-800 dark:text-slate-200">{value}</td>{/each}</tr>{:else}<tr><td colspan={columns.length} class="py-4 text-center text-slate-400">ไม่มีข้อมูล</td></tr>{/each}</tbody></table>
    </div>
  </details>
</Card>
