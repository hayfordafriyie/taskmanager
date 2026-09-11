import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8')

function block(selector: string): string {
  // Match "selector {" so the @custom-variant line ("... .dark, .dark *") in the
  // header comment/variant declaration is not picked up instead of the block.
  const i = css.indexOf(`${selector} {`)
  expect(i, `${selector} block not found`).toBeGreaterThan(-1)
  return css.slice(i, css.indexOf('}', i))
}

function param(name: string, source: string): string | null {
  const after = source.split(`${name}:`)[1]
  if (!after) return null
  const hex = after.trim().match(/^#[0-9a-fA-F]{3,8}/)
  return hex ? hex[0] : null
}

function lum(hex: string): number {
  const n = hex.replace('#', '')
  const full = n.length === 3 ? n.split('').map((c) => c + c).join('') : n
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255)
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

function contrast(a: string, b: string): number {
  const [l1, l2] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (l1 + 0.05) / (l2 + 0.05)
}

describe('chat bubble contrast', () => {
  for (const [theme, selector] of [
    ['light', ':root'],
    ['dark', '.dark'],
  ] as const) {
    it(`own-message text is readable in ${theme} mode`, () => {
      const src = block(selector)
      const bg = param('--bubble-own', src)
      const ink = param('--bubble-own-ink', src)
      expect(bg, '--bubble-own missing').toBeTruthy()
      expect(ink, '--bubble-own-ink missing').toBeTruthy()
      // The bug this guards: the accent was a light grey while the text stayed
      // white, giving ~1.3:1 in dark mode.
      expect(contrast(bg as string, ink as string)).toBeGreaterThanOrEqual(4.5)
    })

    it(`primary button keeps its label readable in ${theme} mode`, () => {
      const src = block(selector)
      const ink = param('--accent-contrast', src)
      expect(ink, '--accent-contrast missing').toBeTruthy()
      for (const stop of ['--accent-1', '--accent-2']) {
        const c = param(stop, src)
        expect(c, `${stop} missing`).toBeTruthy()
        expect(contrast(c as string, ink as string)).toBeGreaterThanOrEqual(4.5)
      }
    })
  }
})
