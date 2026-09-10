import '@testing-library/jest-dom/vitest'
import { vi } from 'vitest'

// jsdom ships none of these APIs, and Radix primitives call them on first
// interaction. The stubs below are intentionally minimal: they only need to
// exist, not to behave like the browser implementations.
//
// `crypto.subtle` no longer needs a shim: the jsdom bundled with this project
// exposes a full WebCrypto implementation, so the encrypted client works under
// test without reaching into Node's `crypto` module.

if (!window.matchMedia) {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })) as unknown as typeof window.matchMedia
}

if (!window.ResizeObserver) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  window.ResizeObserver =
    ResizeObserverStub as unknown as typeof window.ResizeObserver
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
if (typeof window.Element.prototype.scrollIntoView !== 'function') {
  window.Element.prototype.scrollIntoView = () => {}
}
if (typeof window.PointerEvent === 'undefined') {
  class PointerEventStub extends MouseEvent {
    pointerId: number
    isPrimary: boolean

    constructor(type: string, params?: PointerEventInit) {
      super(type, params)
      this.pointerId = params?.pointerId ?? 0
      this.isPrimary = params?.isPrimary ?? true
    }
  }
  window.PointerEvent = PointerEventStub as unknown as typeof window.PointerEvent
}
