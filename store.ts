import { app } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { AppState, DEFAULT_BLOCKS, DEFAULT_SETTINGS, emptyState } from '../src/lib/types'

let cache: AppState | null = null

function filePath(): string {
  return path.join(app.getPath('userData'), 'timetable.json')
}

function bounds(): { x: number; y: number } | null {
  try {
    const p = path.join(app.getPath('userData'), 'window.json')
    return JSON.parse(fs.readFileSync(p, 'utf-8'))
  } catch {
    return null
  }
}

export function loadBounds() {
  return bounds()
}

export function saveBounds(x: number, y: number) {
  try {
    fs.writeFileSync(path.join(app.getPath('userData'), 'window.json'), JSON.stringify({ x, y }))
  } catch {
    /* 저장 실패는 무시 */
  }
}

export function load(): AppState {
  if (cache) return cache
  try {
    const raw = JSON.parse(fs.readFileSync(filePath(), 'utf-8')) as Partial<AppState>
    cache = {
      ...emptyState(),
      ...raw,
      settings: { ...DEFAULT_SETTINGS, ...(raw.settings ?? {}) },
      blocks: raw.blocks?.length ? raw.blocks : DEFAULT_BLOCKS.map((b) => ({ ...b, days: [...b.days] })),
    }
  } catch {
    cache = emptyState()
  }
  return cache
}

export function save(next: AppState): AppState {
  cache = next
  try {
    fs.mkdirSync(path.dirname(filePath()), { recursive: true })
    fs.writeFileSync(filePath(), JSON.stringify(next, null, 2), 'utf-8')
  } catch (e) {
    console.error('설정을 저장하지 못했습니다:', e)
  }
  return cache
}

export function patch(partial: Partial<AppState>): AppState {
  const cur = load()
  return save({ ...cur, ...partial, settings: { ...cur.settings, ...(partial.settings ?? {}) } })
}
