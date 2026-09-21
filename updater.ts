import { app, BrowserWindow, dialog } from 'electron'
import { autoUpdater } from 'electron-updater'

/**
 * 자동 업데이트
 *
 * 위젯이 켜질 때(그리고 켜 둔 동안 3시간마다) GitHub 저장소 chaji0/dankook 의
 * 최신 릴리스를 확인한다. 더 새 버전이 있으면 조용히 받아 두었다가
 * "업데이트가 있습니다" 창을 띄운다.
 *   - 지금 업데이트 → 곧바로 재시작하며 설치
 *   - 나중에       → 다음에 위젯을 끌 때 자동으로 설치
 *
 * 설치파일(.exe)로 설치한 경우에만 동작한다. npm run dev 중에는 건너뛴다.
 */

const CHECK_EVERY_MS = 3 * 60 * 60 * 1000

let asked = false

export function setupAutoUpdate(getWindow: () => BrowserWindow | null) {
  if (!app.isPackaged) return

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true

  autoUpdater.on('update-downloaded', async (info) => {
    if (asked) return
    asked = true
    const win = getWindow()
    const options = {
      type: 'info' as const,
      title: '단국이 시간표',
      message: '업데이트가 있습니다.',
      detail: `새 버전 ${info.version}을(를) 받아 두었습니다.\n지금 적용하면 위젯이 잠깐 꺼졌다가 다시 켜집니다.`,
      buttons: ['지금 업데이트', '나중에'],
      defaultId: 0,
      cancelId: 1,
    }
    const { response } = win ? await dialog.showMessageBox(win, options) : await dialog.showMessageBox(options)
    if (response === 0) {
      autoUpdater.quitAndInstall(true, true)
    }
    // "나중에"를 누르면 위젯을 끌 때 설치된다
  })

  autoUpdater.on('error', (err) => {
    // 학교망 차단·인터넷 끊김 등 — 조용히 넘어가고 다음 확인 때 다시 시도한다
    console.warn('업데이트 확인 실패:', err?.message ?? err)
  })

  const check = () => {
    autoUpdater.checkForUpdates().catch(() => {
      /* 위의 error 이벤트에서 처리 */
    })
  }

  // 켜자마자 확인하면 바탕화면이 뜨기도 전이라, 잠깐 기다렸다가 확인한다
  setTimeout(check, 15_000)
  setInterval(check, CHECK_EVERY_MS)
}
