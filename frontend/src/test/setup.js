import '@testing-library/jest-dom/vitest'
import { webcrypto } from 'node:crypto'

if (!window.matchMedia) {
  window.matchMedia = (query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })
}

if (!window.ResizeObserver) {
  window.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  }
}

if (!window.crypto.subtle) {
  Object.defineProperty(window.crypto, 'subtle', {
    value: webcrypto.subtle,
  })
}

if (typeof window.Element.prototype.hasPointerCapture !== 'function') {
  window.Element.prototype.hasPointerCapture = () => false
}
if (typeof window.Element.prototype.setPointerCapture !== 'function') {
  window.Element.prototype.setPointerCapture = () => {}
}
if (typeof window.Element.prototype.releasePointerCapture !== 'function') {
  window.Element.prototype.releasePointerCapture = () => {}
}
if (typeof window.PointerEvent === 'undefined') {
  class PointerEvent extends MouseEvent {
    constructor(type, params) {
      super(type, params)
      this.pointerId = params?.pointerId ?? 0
      this.isPrimary = params?.isPrimary ?? true
    }
  }
  window.PointerEvent = PointerEvent
}