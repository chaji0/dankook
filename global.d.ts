import type { BearApi } from '../electron/preload'

declare global {
  interface Window {
    bear: BearApi
  }
}

export {}
