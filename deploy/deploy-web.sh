#!/usr/bin/env bash
#
# 墨境前端发布脚本（用受限账号 site-deploy，无需 sudo）
#
# 用法：
#   bash deploy/deploy-web.sh              # 构建 + 发布 + 校验
#   bash deploy/deploy-web.sh --no-build   # 直接发布现有 dist/
#
# 前置：
#   1) 私钥已解密到 ~/.ssh/site_deploy_20261126（见 deploy/README.md §3）
#   2) 在仓库根目录执行

set -euo pipefail

HOST="site-deploy@110.40.142.247"
KEY="${DEPLOY_KEY:-$HOME/.ssh/site_deploy_20261126}"
WEBROOT="/var/www/hw-platform/pet-garden"
SITE="http://sherryworkspace.cn/pet-garden/"
SSH="ssh -i $KEY -o BatchMode=yes -o ConnectTimeout=15 $HOST"
STAMP="$(date +%Y%m%d-%H%M%S)"
BUILD=1

for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    *) echo "未知参数: $arg"; exit 1 ;;
  esac
done

[ -f "$KEY" ] || { echo "缺少私钥：$KEY（见 deploy/README.md §3）"; exit 1; }

if [ "$BUILD" = "1" ]; then
  echo "== 1/5 构建 =="
  node node_modules/vite/bin/vite.js build
fi

echo "== 2/5 打包 =="
rm -rf dist/art-review
tar -czf /tmp/deploy-web.tgz -C dist .
ls -lh /tmp/deploy-web.tgz | awk '{print "包大小:", $5}'

echo "== 3/5 上传 =="
scp -i "$KEY" -o BatchMode=yes /tmp/deploy-web.tgz "$HOST:deploy-web.tgz"

echo "== 4/5 备份并解包 =="
$SSH "set -e
  mkdir -p ~/backups
  tar -czf ~/backups/web-$STAMP.tgz -C /var/www/hw-platform pet-garden 2>/dev/null || true
  rm -rf ~/pg-web && mkdir -p ~/pg-web
  tar -xzf ~/deploy-web.tgz -C ~/pg-web
  # 受限账号不是 webroot 的属主，避免 tar 直接解包（无法改属主/时间戳），改为拷贝覆盖
  rm -rf $WEBROOT/assets
  cp -rf ~/pg-web/. $WEBROOT/
  echo 备份: ~/backups/web-$STAMP.tgz"

echo "== 5/5 线上校验 =="
ASSETS=$(curl -s "$SITE" | grep -oE '/pet-garden/assets/[^"]+' | sort -u)
if [ -z "$ASSETS" ]; then echo "✗ index.html 未取到资源引用"; exit 1; fi
for a in $ASSETS; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://sherryworkspace.cn$a")
  echo "  $code  $a"
  [ "$code" = "200" ] || { echo "✗ 资源校验失败: $a"; exit 1; }
done
code=$(curl -s -o /dev/null -w '%{http_code}' "http://sherryworkspace.cn/api/health")
echo "  $code  /api/health"
echo "✓ 发布完成：$SITE（备份 web-$STAMP.tgz）"
