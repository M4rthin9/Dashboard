<script lang="ts">
  import type { EChartsOption } from 'echarts';
  import type { ECharts } from 'echarts/core';
  import echarts from '../../utils/echarts';

  let { option, height = '280px' }: { option: EChartsOption; height?: string } = $props();

  let el: HTMLDivElement;
  let chart: ECharts | null = null;

  $effect(() => {
    if (!el) return;
    if (!chart) {
      chart = echarts.init(el, undefined, { renderer: 'canvas' });
      const observer = new ResizeObserver(() => chart?.resize());
      observer.observe(el);
      return () => {
        observer.disconnect();
        chart?.dispose();
        chart = null;
      };
    }
  });

  $effect(() => {
    chart?.setOption(option, true);
  });
</script>

<div bind:this={el} style="height:{height}" role="img" aria-label="แผนภูมิ"></div>
