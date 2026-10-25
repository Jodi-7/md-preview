import { describe, expect, it } from 'vitest'
import {
  desktopBaseName,
  desktopDirName,
  pathExtension,
  resolveInside,
} from '../src/lib/desktop'

describe('桌面路径工具', () => {
  it('baseName / dirName 兼容两种分隔符', () => {
    expect(desktopBaseName('D:\\docs\\README.md')).toBe('README.md')
    expect(desktopBaseName('D:/docs/README.md')).toBe('README.md')
    expect(desktopDirName('D:\\docs\\sub\\a.md')).toBe('D:\\docs\\sub')
    expect(desktopBaseName('plain.md')).toBe('plain.md')
  })

  it('pathExtension 返回小写扩展名', () => {
    expect(pathExtension('A.MD')).toBe('.md')
    expect(pathExtension('README')).toBe('')
  })
})

describe('resolveInside', () => {
  it('解析根内相对路径', () => {
    expect(resolveInside('D:\\docs', 'guide/a.md', './img/pic.png')).toBe('D:\\docs\\guide\\img\\pic.png')
    expect(resolveInside('D:\\docs', 'a.md', 'b/c.md')).toBe('D:\\docs\\b\\c.md')
  })

  it('拒绝越出根目录的相对路径', () => {
    expect(resolveInside('D:\\docs', 'a.md', '../secret.md')).toBeNull()
    expect(resolveInside('D:\\docs', 'a.md', '..\\..\\x.md')).toBeNull()
  })

  it('拒绝绝对路径与协议地址', () => {
    expect(resolveInside('D:\\docs', 'a.md', '/etc/passwd')).toBeNull()
    expect(resolveInside('D:\\docs', 'a.md', 'D:\\other\\x.md')).toBeNull()
    expect(resolveInside('D:\\docs', 'a.md', 'https://example.com/x.png')).toBeNull()
    expect(resolveInside('D:\\docs', 'a.md', '//cdn.example.com/x.png')).toBeNull()
  })

  it('剥掉查询串与锚点', () => {
    expect(resolveInside('D:\\docs', 'a.md', 'img.png?size=100#frag')).toBe('D:\\docs\\img.png')
  })
})
