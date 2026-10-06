<script lang="ts">
  import type { EChartsOption } from 'echarts';
  import type { ECharts } from 'echarts/core';
  import echarts from '../../utils/echarts';
  import { ui } from '../../store/ui.svelte';

  let { option, height = '280px', label = 'แผนภูมิ' }: { option: EChartsOption; height?: string; label?: string } = $props();

  let el: HTMLDivElement;
  let chart = $state.raw<ECharts | null>(null);

  $effect(() => {
    if (!el) return;
    const instance = echarts.init(el, ui.darkMode ? 'dark' : undefined, { renderer: 'canvas' });
    chart = instance;
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(el);
    return () => {
      observer.disconnect();
      instance.dispose();
      chart = null;
    };
  });

  $effect(() => {
    chart?.setOption({ ...option, aria: { enabled: true } }, { notMerge: true, lazyUpdate: true });
  });
</script>

<div bind:this={el} style="height:{height}" role="img" aria-label={label}></div>
