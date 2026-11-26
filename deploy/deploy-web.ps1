<#
  墨境前端发布脚本（Windows / PowerShell 版）

  用法（仓库根目录）：
    powershell -ExecutionPolicy Bypass -File deploy\deploy-web.ps1
    powershell -ExecutionPolicy Bypass -File deploy\deploy-web.ps1 -NoBuild

  前置：私钥已解密到 $env:USERPROFILE\.ssh\site_deploy_20261126（见 deploy/README.md §3）
#>
param(
  [switch]$NoBuild,
  [string]$KeyPath = "$env:USERPROFILE\.ssh\site_deploy_20261126"
)

$ErrorActionPreference = 'Stop'
$Host_ = 'site-deploy@110.40.142.247'
$WebRoot = '/var/www/hw-platform/pet-garden'
$Site = 'http://sherryworkspace.cn/pet-garden/'
$Stamp = Get-Date -Format 'yyyyMMdd-HHmmss'

if (-not (Test-Path $KeyPath)) { throw "缺少私钥：$KeyPath（见 deploy/README.md §3）" }

if (-not $NoBuild) {
  Write-Host '== 1/5 构建 =='
  node node_modules\vite\bin\vite.js build
  if ($LASTEXITCODE -ne 0) { throw '构建失败' }
}

Write-Host '== 2/5 打包 =='
Remove-Item dist\art-review -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item $env:TEMP\deploy-web.tgz -Force -ErrorAction SilentlyContinue
tar -czf "$env:TEMP\deploy-web.tgz" -C dist .

Write-Host '== 3/5 上传 =='
scp -i $KeyPath -o BatchMode=yes "$env:TEMP\deploy-web.tgz" "${Host_}:deploy-web.tgz"
if ($LASTEXITCODE -ne 0) { throw '上传失败' }

Write-Host '== 4/5 备份并解包 =='
$remote = @"
set -e
mkdir -p ~/backups
tar -czf ~/backups/web-$Stamp.tgz -C /var/www/hw-platform pet-garden 2>/dev/null || true
rm -rf ~/pg-web && mkdir -p ~/pg-web
tar -xzf ~/deploy-web.tgz -C ~/pg-web
rm -rf $WebRoot/assets
cp -r /tmp/pg-web/. $WebRoot/
chmod -R g+w $WebRoot
echo 备份: ~/backups/web-$Stamp.tgz
"@
$remoteTmp = Join-Path $env:TEMP 'deploy-remote.sh'
[IO.File]::WriteAllText($remoteTmp, $remote, (New-Object System.Text.UTF8Encoding($false)))
scp -i $KeyPath -o BatchMode=yes $remoteTmp "${Host_}:/tmp/deploy-remote.sh"
ssh -i $KeyPath -o BatchMode=yes $Host_ 'bash /tmp/deploy-remote.sh'
if ($LASTEXITCODE -ne 0) { throw '远端解包失败' }

Write-Host '== 5/5 线上校验 =='
$html = (Invoke-WebRequest $Site -UseBasicParsing).Content
$assets = [regex]::Matches($html, '/pet-garden/assets/[^"'']+') | ForEach-Object { $_.Value } | Sort-Object -Unique
if (-not $assets) { throw '未取到资源引用' }
foreach ($a in $assets) {
  $code = (Invoke-WebRequest ("http://sherryworkspace.cn" + $a) -UseBasicParsing -Method Head).StatusCode
  Write-Host "  $code  $a"
  if ($code -ne 200) { throw "资源校验失败: $a" }
}
$health = (Invoke-WebRequest 'http://sherryworkspace.cn/api/health' -UseBasicParsing).StatusCode
Write-Host "  $health  /api/health"
Write-Host "✓ 发布完成：$Site（备份 web-$Stamp.tgz）"
