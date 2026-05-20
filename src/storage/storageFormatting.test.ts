import { describe, expect, it } from 'vitest'
import { cleanStorageConfirmationText, formatBytes } from './storageFormatting'

describe('storage formatting', () => {
  it('formats bytes into compact units', () => {
    expect(formatBytes(0)).toBe('0 B')
    expect(formatBytes(512)).toBe('512 B')
    expect(formatBytes(1536)).toBe('1.5 KB')
    expect(formatBytes(2 * 1024 * 1024)).toBe('2 MB')
  })

  it('describes safe session cleanup scope', () => {
    expect(cleanStorageConfirmationText('safe_sessions', 3, 2048)).toBe(
      'Clean 3 safe session files and free 2 KB? Running and waiting sessions will be kept.',
    )
  })

  it('describes old event cleanup scope', () => {
    expect(cleanStorageConfirmationText('old_events', 1, 512)).toBe(
      'Clean 1 old event file and free 512 B? Recent event files will be kept.',
    )
  })
})
