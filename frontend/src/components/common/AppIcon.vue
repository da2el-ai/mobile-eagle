<script lang="ts">
import { defineComponent, h, type PropType } from 'vue';

// インライン SVG アイコン（base.md 5.3）。アイコンフォント・外部リソースは使わない。
// 24x24 の viewBox・currentColor・stroke ベースに正規化する。
type IconNode = [string, Record<string, string | number>];

const ICONS: Record<string, IconNode[]> = {
  menu: [['path', { d: 'M3 6h18M3 12h18M3 18h18' }]],
  filter: [['path', { d: 'M4 5h16l-6 7v6l-4-2v-4z' }]],
  select: [
    ['rect', { x: 4, y: 4, width: 16, height: 16, rx: 3 }],
    ['path', { d: 'M8 12l3 3 5-6' }],
  ],
  // 歯車。円 + 放射状の線で描くと sun アイコンと見分けが付かないため、歯のある形にする。
  settings: [
    ['circle', { cx: 12, cy: 12, r: 3 }],
    [
      'path',
      {
        d: 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z',
      },
    ],
  ],
  close: [['path', { d: 'M6 6l12 12M18 6L6 18' }]],
  'chevron-right': [['path', { d: 'M9 6l6 6-6 6' }]],
  'chevron-down': [['path', { d: 'M6 9l6 6 6-6' }]],
  minus: [['path', { d: 'M5 12h14' }]],
  plus: [['path', { d: 'M12 5v14M5 12h14' }]],
  delete: [['path', { d: 'M5 7h14M10 7V4h4v3M6 7l1 13h10l1-13' }]],
  move: [
    ['path', { d: 'M4 8V6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }],
    ['path', { d: 'M9 13h5m0 0l-2-2m2 2l-2 2' }],
  ],
  // グリッドの子フォルダセル用（grid.md 3.6）。move から矢印を除いた形。
  folder: [
    ['path', { d: 'M4 8V6a1 1 0 0 1 1-1h4l2 2h8a1 1 0 0 1 1 1v9a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z' }],
  ],
  check: [['path', { d: 'M5 12l4 4 8-9' }]],
  sun: [
    ['circle', { cx: 12, cy: 12, r: 4 }],
    [
      'path',
      {
        d: 'M12 2v2M12 20v2M2 12h2M20 12h2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M19.1 4.9l-1.4 1.4M6.3 17.7l-1.4 1.4',
      },
    ],
  ],
  moon: [['path', { d: 'M20 14a8 8 0 0 1-10-10 8 8 0 1 0 10 10z' }]],
};

export default defineComponent({
  name: 'AppIcon',
  props: {
    name: { type: String as PropType<string>, required: true },
    size: { type: Number, default: 24 },
  },
  setup(props) {
    return () =>
      h(
        'svg',
        {
          width: props.size,
          height: props.size,
          viewBox: '0 0 24 24',
          fill: 'none',
          stroke: 'currentColor',
          'stroke-width': 2,
          'stroke-linecap': 'round',
          'stroke-linejoin': 'round',
          'aria-hidden': 'true',
        },
        (ICONS[props.name] ?? []).map(([tag, attrs]) => h(tag, attrs)),
      );
  },
});
</script>
