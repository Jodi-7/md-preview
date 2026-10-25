import { describe, expect, it } from 'vitest'
import {
  editorOffsetForLine,
  interpolateLine,
  lineAtOffset,
} from '../src/lib/scrollSync'

describe('lineAtOffset', () => {
  const offsets = [0, 20, 45, 80, 120]

  it('落在某行起点时返回该行', () => {
    expect(lineAtOffset(offsets, 45)).toBe(2)
  })

  it('落在两行之间时返回上面那行', () => {
    expect(lineAtOffset(offsets, 50)).toBe(2)
  })

  it('超出末尾返回最后一行，小于起点返回 0', () => {
    expect(lineAtOffset(offsets, 9999)).toBe(4)
    expect(lineAtOffset(offsets, -5)).toBe(0)
  })

  it('空量尺返回 0', () => {
    expect(lineAtOffset([], 10)).toBe(0)
  })
})

describe('interpolateLine', () => {
  const marks = [
    { top: 100, line: 0 },
    { top: 200, line: 10 },
    { top: 400, line: 30 },
  ]

  it('段内按比例插值出带小数的行号', () => {
    // 100→200 之间走 0→10 行；y=150 即半程 → 5 行
    expect(interpolateLine(marks, 150)).toBe(5)
    // 200→400 之间走 10→30 行；y=300 即半程 → 20 行
    expect(interpolateLine(marks, 300)).toBe(20)
    expect(interpolateLine(marks, 250)).toBe(15)
  })

  it('探针在首块之前/末块之后时夹在边界', () => {
    expect(interpolateLine(marks, 50)).toBe(0)
    expect(interpolateLine(marks, 999)).toBe(30)
  })

  it('正好落在块上返回该块行号', () => {
    expect(interpolateLine(marks, 200)).toBe(10)
  })

  it('空映射返回 0', () => {
    expect(interpolateLine([], 100)).toBe(0)
  })
})

describe('editorOffsetForLine', () => {
  const offsets = [0, 20, 45, 80]

  it('整数行号直接取量尺值', () => {
    expect(editorOffsetForLine(offsets, 2)).toBe(45)
    expect(editorOffsetForLine(offsets, 0)).toBe(0)
  })

  it('小数行号在相邻两行之间线性取值', () => {
    expect(editorOffsetForLine(offsets, 2.5)).toBeCloseTo(62.5)
    expect(editorOffsetForLine(offsets, 0.5)).toBeCloseTo(10)
  })

  it('超出量尺范围时夹到最后一行', () => {
    expect(editorOffsetForLine(offsets, 99)).toBe(80)
  })

  it('空量尺返回 0', () => {
    expect(editorOffsetForLine([], 3)).toBe(0)
  })
})
