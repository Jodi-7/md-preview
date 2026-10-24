<#
  把 Markdown 预览器注册成 .md 的打开方式。

  用法（普通权限即可，只写 HKCU，不需要管理员）：
    pwsh -File scripts\associate-md.ps1                # 只注册到「打开方式」列表
    pwsh -File scripts\associate-md.ps1 -SetDefault    # 同时设为 .md 的默认程序
    pwsh -File scripts\associate-md.ps1 -Undo          # 撤销上面的改动
#>
[CmdletBinding()]
param(
  [string]$ExePath = (Join-Path $PSScriptRoot '..\release\MarkdownPreview\MarkdownPreview.exe'),
  [switch]$SetDefault,
  [switch]$Undo
)

$ErrorActionPreference = 'Stop'
$progId = 'MarkdownPreview.md'
$classes = 'HKCU:\Software\Classes'
$mdKey = Join-Path $classes '.md'
$backupKey = Join-Path $classes '.md.bak-before-markdownpreview'

if ($Undo) {
  Remove-Item -Path (Join-Path $classes $progId) -Recurse -Force -ErrorAction SilentlyContinue
  $progids = Join-Path $mdKey 'OpenWithProgids'
  if (Test-Path $progids) {
    Remove-ItemProperty -Path $progids -Name $progId -ErrorAction SilentlyContinue
  }
  if (Test-Path $backupKey) {
    $previous = (Get-ItemProperty -Path $backupKey -Name '(default)' -ErrorAction SilentlyContinue).'(default)'
    if ($previous) {
      Set-Item -Path $mdKey -Value $previous -Force
    } else {
      Remove-Item -Path $mdKey -Force -ErrorAction SilentlyContinue
    }
    Remove-Item -Path $backupKey -Recurse -Force
  }
  Write-Host '已撤销 .md 关联。' -ForegroundColor Yellow
  exit 0
}

if (-not (Test-Path $ExePath)) {
  throw "找不到可执行文件：$ExePath（先运行 pnpm dist 打包）"
}
$exe = (Resolve-Path $ExePath).Path

# 1) 定义 ProgId
New-Item -Path (Join-Path $classes $progId) -Force | Out-Null
Set-Item -Path (Join-Path $classes $progId) -Value 'Markdown 文档'
New-Item -Path (Join-Path $classes "$progId\DefaultIcon") -Force | Out-Null
Set-Item -Path (Join-Path $classes "$progId\DefaultIcon") -Value "$exe,0"
New-Item -Path (Join-Path $classes "$progId\shell\open\command") -Force | Out-Null
Set-Item -Path (Join-Path $classes "$progId\shell\open\command") -Value "`"$exe`" `"%1`""

# 2) 登记到 .md 的「打开方式」
New-Item -Path $mdKey -Force | Out-Null
$progids = Join-Path $mdKey 'OpenWithProgids'
New-Item -Path $progids -Force | Out-Null
[Microsoft.Win32.Registry]::SetValue(
  "HKEY_CURRENT_USER\Software\Classes\.md\OpenWithProgids",
  $progId,
  [byte[]]@(),
  [Microsoft.Win32.RegistryValueKind]::None
)

# 3) 可选：设为默认
if ($SetDefault) {
  if (-not (Test-Path $backupKey)) {
    New-Item -Path $backupKey -Force | Out-Null
    $current = (Get-ItemProperty -Path $mdKey -Name '(default)' -ErrorAction SilentlyContinue).'(default)'
    if ($null -ne $current) { Set-Item -Path $backupKey -Value $current }
  }
  Set-Item -Path $mdKey -Value $progId
  Write-Host '已设为 .md 的默认打开程序（撤销：-Undo）' -ForegroundColor Green
} else {
  Write-Host '已注册到「打开方式」列表。想双击 .md 直接打开，再加 -SetDefault。' -ForegroundColor Cyan
}

Write-Host "可执行文件：$exe"
