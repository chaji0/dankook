import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ExcelError, buildTargets, deriveClassTimetables, parseWorkbook } from './excel'
import type { Lesson } from '../src/lib/types'
import * as store from './store'
import { setupAutoUpdate } from './updater'
import { AppState, Settings } from '../src/lib/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 단국이 버튼이 차지하는 정사각형 크기 (창 오른쪽 아래에 붙어 있다) */
const BEAR = 108
/** 합친 수업으로 학급 자동 생성과 검색 목록을 다시 만든다 */
function rebuild(own: Lesson[]) {
  const base = own.filter((l) => !l.derived)
  const lessons = [...base, ...deriveClassTimetables(base)]
  return { lessons, targets: buildTargets(lessons) }
}

/** 위젯 크기 설정별 창 크기 (칸 높이는 src/lib/themes.ts 의 CELL_HEIGHT) */
const PANEL_SIZES = {
  small: { width: 620, height: 540 },
  medium: { width: 720, height: 640 },
  large: { width: 880, height: 780 },
} as const

type Mode = 'collapsed' | 'expanded' | 'settings'

let win: BrowserWindow | null = null
let mode: Mode = 'collapsed'
let dragOffset = { x: 0, y: 0 }

function sizeFor(m: Mode) {
  if (m === 'collapsed') return { width: BEAR, height: BEAR }
  // 설정 화면은 위젯 크기와 상관없이 늘 같은 크기
  if (m === 'settings') return PANEL_SIZES.medium
  const key = store.load().settings.widgetSize
  return PANEL_SIZES[key] ?? PANEL_SIZES.medium
}

/** 단국이 얼굴의 화면상 좌표 (창 오른쪽 아래 모서리 기준) */
function bearOrigin(): { x: number; y: number } {
  if (!win) return { x: 0, y: 0 }
  const [x, y] = win.getPosition()
  const [w, h] = win.getSize()
  return { x: x + w - BEAR, y: y + h - BEAR }
}

function clampToDisplay(x: number, y: number, w: number, h: number) {
  const display = screen.getDisplayNearestPoint({ x: x + w - BEAR / 2, y: y + h - BEAR / 2 })
  const a = display.workArea
  return {
    x: Math.round(Math.min(Math.max(x, a.x), a.x + a.width - w)),
    y: Math.round(Math.min(Math.max(y, a.y), a.y + a.height - h)),
  }
}

function applyMode(next: Mode) {
  if (!win) return
  const bear = bearOrigin()
  mode = next
  const { width, height } = sizeFor(next)
  // 단국이는 제자리에 두고 창만 왼쪽 위로 자란다
  const raw = { x: bear.x + BEAR - width, y: bear.y + BEAR - height }
  const pos = clampToDisplay(raw.x, raw.y, width, height)
  win.setBounds({ ...pos, width, height }, false)
  win.webContents.send('ui:mode', next)
}

function applySettings(s: Settings) {
  if (!win) return
  win.setAlwaysOnTop(s.alwaysOnTop, 'screen-saver')
  // 위젯 크기를 바꿨으면 펼쳐진 창 크기를 바로 맞춘다
  if (mode !== 'collapsed') {
    const want = sizeFor(mode)
    const [w, h] = win.getSize()
    if (w !== want.width || h !== want.height) applyMode(mode)
  }
  if (process.platform === 'win32' || process.platform === 'darwin') {
    app.setLoginItemSettings({ openAtLogin: s.autoLaunch, args: [] })
  }
}

function createWindow() {
  const saved = store.loadBounds()
  const area = screen.getPrimaryDisplay().workArea
  const start = saved ?? { x: area.x + area.width - BEAR - 32, y: area.y + area.height - BEAR - 32 }

  win = new BrowserWindow({
    ...start,
    width: BEAR,
    height: BEAR,
    frame: false,
    transparent: true,
    backgroundColor: '#00000000',
    resizable: false,
    maximizable: false,
    fullscreenable: false,
    hasShadow: false,
    skipTaskbar: false,
    title: '단국이 시간표',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  applySettings(store.load().settings)

  if (process.env.VITE_DEV_SERVER_URL) {
    win.loadURL(process.env.VITE_DEV_SERVER_URL)
  } else {
    win.loadFile(path.join(__dirname, '../dist/index.html'))
  }

  win.on('moved', () => {
    if (!win) return
    const [x, y] = win.getPosition()
    store.saveBounds(x, y)
  })

  // 외부 링크는 기본 브라우저로
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

/* ──────────────── IPC ──────────────── */

ipcMain.handle('state:get', () => store.load())

ipcMain.handle('state:patch', (_e, partial: Partial<AppState>) => {
  const next = store.patch(partial)
  applySettings(next.settings)
  return next
})

ipcMain.handle('ui:setMode', (_e, next: Mode) => {
  applyMode(next)
  return next
})

ipcMain.handle('ui:getMode', () => mode)

ipcMain.on('drag:start', (_e, offset: { x: number; y: number }) => {
  dragOffset = offset
})

ipcMain.on('drag:move', (_e, pt: { x: number; y: number }) => {
  if (!win) return
  // Windows 화면 배율(125%·150%)에서 setPosition을 여러 번 부르면 창이 1px씩 커지는 문제가 있어서,
  // 늘 정해진 크기로 setBounds 한다
  const { width, height } = sizeFor(mode)
  // dragOffset은 잡은 지점의 창 안쪽 좌표라서 그대로 빼면 창 왼쪽 위가 된다
  const pos = clampToDisplay(pt.x - dragOffset.x, pt.y - dragOffset.y, width, height)
  win.setBounds({ x: pos.x, y: pos.y, width, height }, false)
})

ipcMain.handle('excel:import', async () => {
  if (!win) return null
  const res = await dialog.showOpenDialog(win, {
    title: '시간표 엑셀 파일 선택',
    filters: [{ name: '엑셀 파일', extensions: ['xlsx', 'xls', 'xlsm', 'csv'] }],
    properties: ['openFile'],
  })
  if (res.canceled || res.filePaths.length === 0) return { canceled: true }

  const file = res.filePaths[0]
  try {
    const name = path.basename(file)
    const parsed = parseWorkbook(fs.readFileSync(file), name)
    const cur = store.load()
    // 선생님·학급·학생 파일을 따로 올릴 수 있게 합친다.
    // 같은 파일을 다시 올리거나 같은 사람(반)이 다시 들어오면 새로 읽은 쪽으로 바꾼다.
    const incoming = new Set(parsed.targets.map((t) => t.key))
    const keep = cur.lessons.filter(
      (l) => !l.derived && l.source !== name && !incoming.has(`${l.kind}:${l.id || l.name}`),
    )
    const built = rebuild([...keep, ...parsed.lessons])
    const next = store.patch({
      ...built,
      sourceFile: name,
      sources: [...cur.sources.filter((f) => f !== name), name],
      importedAt: new Date().toISOString(),
    })
    const warnings = [...parsed.warnings]
    const made = new Set(built.lessons.filter((l) => l.derived && l.source === name).map((l) => l.name)).size
    if (made > 0) warnings.push(`선생님 시간표에서 학급 ${made}개의 시간표를 함께 만들었습니다.`)
    return { canceled: false, state: next, warnings }
  } catch (e) {
    const message = e instanceof ExcelError ? e.message : `파일을 읽지 못했습니다. (${String(e)})`
    return { canceled: false, error: message }
  }
})

/** 불러온 파일 하나만 지운다 */
ipcMain.handle('excel:remove', (_e, name: string) => {
  const cur = store.load()
  const built = rebuild(cur.lessons.filter((l) => !l.derived && l.source !== name))
  const sources = cur.sources.filter((f) => f !== name)
  return store.patch({ ...built, sources, sourceFile: sources[sources.length - 1] ?? '' })
})

ipcMain.handle('excel:clear', () => {
  return store.patch({ lessons: [], targets: [], sourceFile: '', sources: [], importedAt: '' })
})

ipcMain.handle('app:quit', () => {
  app.quit()
})

ipcMain.handle('app:openDataFolder', () => {
  shell.openPath(app.getPath('userData'))
})

/* ──────────────── 앱 수명주기 ──────────────── */

// 창이 하나뿐인 위젯이라 중복 실행을 막는다
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    if (win) {
      win.show()
      win.focus()
    }
  })

  app.whenReady().then(() => {
    store.migrateFromOldName()
    createWindow()
    setupAutoUpdate(() => win)
  })

  app.on('window-all-closed', () => {
    app.quit()
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
}
