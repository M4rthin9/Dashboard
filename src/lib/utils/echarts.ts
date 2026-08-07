import * as echarts from 'echarts/core';
import { BarChart, LineChart, PieChart, FunnelChart } from 'echarts/charts';
import {
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
} from 'echarts/components';
import { CanvasRenderer } from 'echarts/renderers';

echarts.use([
  BarChart,
  LineChart,
  PieChart,
  FunnelChart,
  GridComponent,
  TooltipComponent,
  LegendComponent,
  TitleComponent,
  CanvasRenderer,
]);

echarts.registerTheme('dark', {
  color: ['#5470c6', '#91cc75', '#fac858', '#ee6666', '#73c0de', '#3ba272', '#fc8452', '#9a60b4', '#ea7ccc'],
  backgroundColor: 'transparent',
  textStyle: { color: '#cbd5e1' },
  title: { textStyle: { color: '#e2e8f0' }, subtextStyle: { color: '#94a3b8' } },
  legend: { textStyle: { color: '#cbd5e1' } },
  tooltip: {
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    textStyle: { color: '#e2e8f0' },
  },
  categoryAxis: {
    axisLine: { lineStyle: { color: '#475569' } },
    axisTick: { lineStyle: { color: '#475569' } },
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#334155' } },
  },
  valueAxis: {
    axisLine: { lineStyle: { color: '#475569' } },
    axisLabel: { color: '#94a3b8' },
    splitLine: { lineStyle: { color: '#334155' } },
  },
});

export default echarts;
