/**
 * 테마색 — 한 가지 색을 고르면
 *   선택된 버튼 · 지금 교시 칸 · 학반/학생 시간표 칸 바탕 · 곰돌이 고리
 * 에 쓰인다. 글씨는 어떤 테마에서도 읽기 쉽게 짙은 먹색으로 고정한다.
 */
export interface Theme {
  id: string
  name: string
  color: string
}

export const THEMES: Theme[] = [
  { id: 'blue', name: '파랑', color: '#2F86DD' },
  { id: 'sky', name: '하늘', color: '#3FB6DB' },
  { id: 'teal', name: '청록', color: '#28B39A' },
  { id: 'green', name: '초록', color: '#3F9D6E' },
  { id: 'orange', name: '주황', color: '#DD8B48' },
  { id: 'coral', name: '산호', color: '#EF7A5E' },
  { id: 'pink', name: '분홍', color: '#E5739E' },
  { id: 'slate', name: '회청', color: '#6A84AA' },
  { id: 'sand', name: '모래', color: '#A1896A' },
  { id: 'navy', name: '남색', color: '#1E2D4B' },
]

export type SizeStep = 'small' | 'medium' | 'large'

export const SIZE_LABELS: Record<SizeStep, string> = { small: '작게', medium: '보통', large: '크게' }

/** 위젯 크기 → 시간표 칸 높이 (창 크기는 electron/main.ts 의 PANEL_SIZES) */
export const CELL_HEIGHT: Record<SizeStep, number> = { small: 40, medium: 52, large: 68 }

/** 글씨 크기 배율 */
export const FONT_SCALE: Record<SizeStep, number> = { small: 0.9, medium: 1, large: 1.15 }

function rgbOf(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** 이 색 위에 흰 글씨가 잘 보이는지 (WCAG 상대 휘도) */
function prefersWhiteText([r, g, b]: [number, number, number]): boolean {
  const lin = (c: number) => {
    const v = c / 255
    return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4
  }
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
  // 흰 글씨 대비와 먹색 글씨 대비 중 큰 쪽
  return (1.05 / (L + 0.05)) >= ((L + 0.05) / (0.02 + 0.05))
}

export function findTheme(id: string): Theme {
  return THEMES.find((t) => t.id === id) ?? THEMES[0]
}

/** 화면 설정을 CSS 변수로 적용 */
export function applyLook(opts: { theme: string; widgetSize: SizeStep; fontSize: SizeStep; opacity: number }) {
  const t = findTheme(opts.theme)
  const rgb = rgbOf(t.color)
  const root = document.documentElement.style
  root.setProperty('--primary', t.color)
  root.setProperty('--primary-rgb', rgb.join(', '))
  root.setProperty('--on-primary-rgb', prefersWhiteText(rgb) ? '255, 255, 255' : '28, 32, 40')
  root.setProperty('--cell-h', `${CELL_HEIGHT[opts.widgetSize] ?? 52}px`)
  root.setProperty('--fs', String(FONT_SCALE[opts.fontSize] ?? 1))
  root.setProperty('--surface-alpha', String(opts.opacity))
}
