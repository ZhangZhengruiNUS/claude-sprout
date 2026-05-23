import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beginPetContextMenu, beginPetDrag } from './petWindowControls'

const setSizeMock = vi.fn()
const setPositionMock = vi.fn()
const outerPositionMock = vi.fn()
const scaleFactorMock = vi.fn()

vi.mock('@tauri-apps/api/window', () => ({
  getCurrentWindow: () => ({
    outerPosition: outerPositionMock,
    scaleFactor: scaleFactorMock,
    setSize: setSizeMock,
    setPosition: setPositionMock,
  }),
  Window: class {},
}))

describe('pet window controls', () => {
  beforeEach(() => {
    ;(globalThis as { isTauri?: boolean }).isTauri = true
    setSizeMock.mockReset().mockResolvedValue(undefined)
    setPositionMock.mockReset().mockResolvedValue(undefined)
    outerPositionMock.mockReset().mockResolvedValue({ x: 100, y: 120 })
    scaleFactorMock.mockReset().mockResolvedValue(2)
  })

  afterEach(() => {
    delete (globalThis as { isTauri?: boolean }).isTauri
  })

  it('shrinks imported pet windows while dragging and restores the original layout size', async () => {
    const dragSession = await beginPetDrag(
      { screenX: 150, screenY: 160 },
      {
        dragSize: { width: 216, height: 232 },
        restoreSize: { width: 315, height: 424 },
      },
    )

    await dragSession?.start?.()
    await dragSession?.move(170, 190)
    await dragSession?.end?.()

    expect(setSizeMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ width: 216, height: 232 }),
    )
    expect(setPositionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ x: 100, y: 120 }),
    )
    expect(setPositionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ x: 140, y: 180 }),
    )
    expect(setSizeMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ width: 315, height: 424 }),
    )
  })

  it('anchors a resized drag window to the visible pet target instead of the wider activity window', async () => {
    const dragSession = await beginPetDrag(
      {
        screenX: 350,
        screenY: 260,
        targetOffsetX: 78,
        targetOffsetY: 92,
        targetWidth: 157,
        targetHeight: 187,
      },
      {
        dragSize: { width: 216, height: 232 },
        restoreSize: { width: 360, height: 424 },
      },
    )

    await dragSession?.start?.()
    await dragSession?.move(370, 280)

    expect(setPositionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ x: 485, y: 291 }),
    )
    expect(setPositionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ x: 525, y: 331 }),
    )
  })

  it('expands the pet window around the cursor while a context menu is open', async () => {
    const menuSession = await beginPetContextMenu(
      { x: 140, y: 160 },
      { width: 180, height: 210 },
    )

    expect(menuSession.position).toEqual({ x: 220, y: 272 })
    expect(setSizeMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ width: 340, height: 434 }),
    )
    expect(setPositionMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ x: -60, y: -104 }),
    )

    await menuSession.end()

    expect(setSizeMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ width: 180, height: 210 }),
    )
    expect(setPositionMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ x: 100, y: 120 }),
    )
  })
})
