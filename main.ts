import { app, BrowserWindow, dialog, ipcMain, screen, shell } from 'electron'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { ExcelError, parseWorkbook } from './excel'
import * as store from './store'
import { setupAutoUpdate } from './updater'
import { AppState, Settings } from '../src/lib/types'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

/** 곰돌이 버튼이 차지하는 정사각형 크기 (창 오른쪽 아래에 붙어 있다) */
const BEAR = 108
const PANEL = { width: 860, height: 620 }

type Mode = 'collapsed' | 'expanded' | 'settings'

let win: BrowserWindow | null = null
let mode: Mode = 'collapsed'
let dragOffset = { x: 0, y: 0 }

function sizeFor(m: Mode) {
  return m === 'collapsed' ? { width: BEAR, height: BEAR } : PANEL
}

/** 곰돌이 얼굴의 화면상 좌표 (창 오른쪽 아래 모서리 기준) */
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
  // 곰돌이는 제자리에 두고 창만 왼쪽 위로 자란다
  const raw = { x: bear.x + BEAR - width, y: bear.y + BEAR - height }
  const pos = clampToDisplay(raw.x, raw.y, width, height)
  win.setBounds({ ...pos, width, height }, false)
  win.webContents.send('ui:mode', next)
}

function applySettings(s: Settings) {
  if (!win) return
  win.setAlwaysOnTop(s.alwaysOnTop, 'screen-saver')
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
    title: '곰돌이 시간표',
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
  const { width, height } = win.getBounds()
  // dragOffset은 잡은 지점의 창 안쪽 좌표라서 그대로 빼면 창 왼쪽 위가 된다
  const pos = clampToDisplay(pt.x - dragOffset.x, pt.y - dragOffset.y, width, height)
  win.setPosition(pos.x, pos.y, false)
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
    const buffer = fs.readFileSync(file)
    const parsed = parseWorkbook(buffer)
    const cur = store.load()
    // 선생님 파일과 학생 파일을 따로 올릴 수 있게 합쳐서 저장한다.
    // 같은 사람(반)이 다시 들어오면 새로 읽은 쪽으로 바꾼다.
    const incoming = new Set(parsed.targets.map((t) => t.key))
    const keep = cur.lessons.filter((l) => !incoming.has(`${l.kind}:${l.id || l.name}`))
    const lessons = [...keep, ...parsed.lessons]
    const targets = [...cur.targets.filter((t) => !incoming.has(t.key)), ...parsed.targets].sort(
      (a, b) => a.label.localeCompare(b.label, 'ko'),
    )
    const name = path.basename(file)
    const next = store.patch({
      lessons,
      targets,
      sourceFile: name,
      sources: [...cur.sources.filter((f) => f !== name), name],
      importedAt: new Date().toISOString(),
    })
    return { canceled: false, state: next, warnings: parsed.warnings }
  } catch (e) {
    const message = e instanceof ExcelError ? e.message : `파일을 읽지 못했습니다. (${String(e)})`
    return { canceled: false, error: message }
  }
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
