import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { StoragePanel } from './StoragePanel'
import type { StorageSummary } from './storageApi'

function summary(cleanableFileCount: number): StorageSummary {
  return {
    rootPath: 'C:/Users/Test/.claude-sprout',
    sessions: {
      fileCount: 3,
      directoryCount: 0,
      totalBytes: 300,
      cleanableFileCount,
      cleanableBytes: cleanableFileCount * 100,
    },
    events: {
      fileCount: 1,
      directoryCount: 0,
      totalBytes: 50,
      cleanableFileCount: 0,
      cleanableBytes: 0,
    },
    pets: {
      fileCount: 2,
      directoryCount: 1,
      totalBytes: 500,
      cleanableFileCount: 0,
      cleanableBytes: 0,
    },
  }
}

type ButtonInfo = {
  children: React.ReactNode
  disabled: boolean | undefined
  onClick: (() => void) | undefined
}

type FunctionComponent = (props: Record<string, unknown>) => React.ReactNode

function collectButtons(node: React.ReactNode): ButtonInfo[] {
  if (!node || typeof node !== 'object' || !('props' in node)) {
    return []
  }

  const element = node as React.ReactElement<{
    children?: React.ReactNode
    disabled?: boolean
    onClick?: () => void
  }>
  if (typeof element.type === 'function') {
    return collectButtons((element.type as FunctionComponent)(element.props))
  }
  const ownButtons: ButtonInfo[] =
    element.type === 'button'
      ? [
          {
            children: element.props.children,
            disabled: element.props.disabled,
            onClick: element.props.onClick,
          },
        ]
      : []
  return [...ownButtons, ...React.Children.toArray(element.props.children).flatMap(collectButtons)]
}

function buttonText(children: React.ReactNode): string {
  return React.Children.toArray(children)
    .map((child) => {
      if (typeof child === 'string') return child
      if (typeof child === 'number') return String(child)
      return ''
    })
    .join('')
}

describe('StoragePanel', () => {
  it('enables safe session cleanup only when cleanable files exist', () => {
    const onClean = vi.fn()
    const buttons = collectButtons(
      StoragePanel({
        summary: summary(2),
        isLoading: false,
        isCleaning: false,
        message: null,
        onRefresh: vi.fn(),
        onClean,
        onOpenDataFolder: vi.fn(),
      }),
    )
    const cleanButton = buttons.find((button) => buttonText(button.children) === 'Clean safe sessions')

    expect(cleanButton?.disabled ?? false).toBe(false)

    cleanButton?.onClick?.()

    expect(onClean).toHaveBeenCalledWith('safe_sessions')
  })

  it('disables safe session cleanup when no cleanable files exist', () => {
    const buttons = collectButtons(
      StoragePanel({
        summary: summary(0),
        isLoading: false,
        isCleaning: false,
        message: null,
        onRefresh: vi.fn(),
        onClean: vi.fn(),
        onOpenDataFolder: vi.fn(),
      }),
    )
    const cleanButton = buttons.find((button) => buttonText(button.children) === 'Clean safe sessions')

    expect(cleanButton?.disabled).toBe(true)
  })
})
