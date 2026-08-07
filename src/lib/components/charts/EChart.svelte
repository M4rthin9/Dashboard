<script lang="ts">
  import type { EChartsOption } from 'echarts';
  import type { ECharts } from 'echarts/core';
  import echarts from '../../utils/echarts';
  import { ui } from '../../store/ui.svelte';

  let { option, height = '280px' }: { option: EChartsOption; height?: string } = $props();

  let el: HTMLDivElement;
  let chart: ECharts | null = null;

  $effect(() => {
    if (!el) return;
    chart?.dispose();
    chart = echarts.init(el, ui.darkMode ? 'dark' : undefined, { renderer: 'canvas' });
    chart.setOption(option, true);
    const observer = new ResizeObserver(() => chart?.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      chart?.dispose();
      chart = null;
    };
  });
</script>

<div bind:this={el} style="height:{height}" role="img" aria-label="แผนภูมิ"></div>
