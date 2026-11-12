#!/usr/bin/env bash
#
# 班级宠物园（王宠课堂 v3）前端部署脚本
#
# 用法：
#   bash deploy.sh              构建 + 部署 + 校验
#   bash deploy.sh --no-build   跳过构建，直接部署现有 dist/
#   bash deploy.sh --check-only 只做线上校验，不传输
#
# 为什么长这样（2026-11-04 白屏事故的教训）：
#   事故根因是手动 scp，index.html 与 assets/ 来自两次不同构建，
#   线上 index.html 引用了根本不存在的 index-BlQSroqt.js → 白屏。
#   所以本脚本强制：整目录 rsync --delete（版本必然自洽）+ 部署后逐条
#   校验 index.html 引用的每个资源线上确实返回 200。

set -euo pipefail

# ── 配置 ─────────────────────────────────────────────
SERVER_HOST="110.40.142.247"
SERVER_USER="ubuntu"
SSH_KEY="${HOME}/.ssh/hw_server_key"
WEBROOT="/var/www/hw-platform/pet-garden"
STAGING="/tmp/pet-garden-deploy"
SITE_URL="http://${SERVER_HOST}/pet-garden/"

SSH="ssh -i ${SSH_KEY} -o BatchMode=yes -o ConnectTimeout=15 ${SERVER_USER}@${SERVER_HOST}"

DO_BUILD=1
DO_DEPLOY=1
while [ $# -gt 0 ]; do
  case "$1" in
    --no-build)   DO_BUILD=0 ;;
    --check-only) DO_BUILD=0; DO_DEPLOY=0 ;;
    *) echo "未知参数: $1"; exit 2 ;;
  esac
  shift
done

# 切到脚本所在目录，避免依赖调用时的 cwd
cd "$(dirname "${BASH_SOURCE[0]}")"

echo "🚀 部署 班级宠物园 → ${SITE_URL}"

# ── 1. 构建 + 产物自检 ───────────────────────────────
if [ "${DO_BUILD}" = "1" ]; then
  echo "🔨 构建（含 vue-tsc 类型检查）..."
  npm run build

  echo "🔍 构建产物自检..."
  npm run build:check
fi

if [ ! -f dist/index.html ]; then
  echo "❌ dist/index.html 不存在，先跑 bash deploy.sh（不带 --no-build）"
  exit 1
fi

# ── 2. 传输 ──────────────────────────────────────────
if [ "${DO_DEPLOY}" = "1" ]; then
  # Git Bash 没有 rsync，且 scp -r 曾出现"87 个 chunk 只传了 2 个"的半传情况。
  # 改为打单个 tar 包：传输是原子的，要么整个成功要么失败，不会留下混合版本。
  TARBALL="/tmp/pet-garden-dist.tgz"
  echo "📦 打包 dist/ → ${TARBALL}"
  tar -czf "${TARBALL}" -C dist .

  echo "📤 上传并同步到 webroot ..."
  scp -i "${SSH_KEY}" -o BatchMode=yes "${TARBALL}" "${SERVER_USER}@${SERVER_HOST}:${STAGING}.tgz"

  # webroot 属主是 www-data，ubuntu 只能写 /tmp，故两段式：/tmp → sudo rsync
  ${SSH} "
    set -e
    rm -rf ${STAGING} && mkdir -p ${STAGING}
    tar -xzf ${STAGING}.tgz -C ${STAGING}
    rm -f ${STAGING}.tgz
    if [ -d ${WEBROOT} ]; then
      sudo tar -czf /tmp/pet-garden-webroot-backup.tgz -C ${WEBROOT} . 2>/dev/null || true
    fi
    sudo rsync -a --delete ${STAGING}/ ${WEBROOT}/
    sudo chown -R www-data:www-data ${WEBROOT}
    sudo chmod -R u=rwX,go=rX ${WEBROOT}
    rm -rf ${STAGING}
  "
  echo "✅ 文件已同步（回滚包：服务器 /tmp/pet-garden-webroot-backup.tgz）"
fi

# ── 3. 部署后校验：index.html 引用的每个资源必须 200 ──
echo "🔎 校验线上资源可达性..."
HTML=$(curl -fsS -H 'Cache-Control: no-cache' "${SITE_URL}")

# 提取 /pet-garden/assets/... 的 js 与 css 引用
REFS=$(printf '%s' "${HTML}" \
  | grep -o '/pet-garden/assets/[A-Za-z0-9._-]*\.\(js\|css\)' \
  | sort -u)

if [ -z "${REFS}" ]; then
  echo "❌ index.html 里没解析到任何 assets 引用，部署可疑"
  echo "--- 实际返回内容 ---"; printf '%s\n' "${HTML}"
  exit 1
fi

FAILED=0
for ref in ${REFS}; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://${SERVER_HOST}${ref}")
  if [ "${code}" = "200" ]; then
    echo "   ✓ ${ref}"
  else
    echo "   ✗ ${ref}  → HTTP ${code}"
    FAILED=1
  fi
done

# 本地 dist 与线上 assets 必须逐字节同数（防"只传了部分 chunk"）
LOCAL_ASSETS=$(find dist/assets -type f | wc -l | tr -d ' ')
REMOTE_ASSETS=$(${SSH} "find ${WEBROOT}/assets -type f 2>/dev/null | wc -l" | tr -d ' ')
if [ "${LOCAL_ASSETS}" != "${REMOTE_ASSETS}" ]; then
  echo "   ✗ assets 数量不一致：本地 ${LOCAL_ASSETS} ≠ 线上 ${REMOTE_ASSETS}"
  FAILED=1
else
  echo "   ✓ assets 数量一致：${REMOTE_ASSETS} 个文件"
fi

# API 连通性（v3 契约的公开端点）
for path in /api/health /api/v3/config /api/v3/pets/templates /api/v3/gacha/rates; do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://${SERVER_HOST}${path}")
  echo "   ${path} → HTTP ${code}"
  [ "${code}" = "200" ] || FAILED=1
done

if [ "${FAILED}" != "0" ]; then
  echo "❌ 校验未通过。白屏风险未排除，别收工。"
  echo "   回滚：ssh ubuntu@${SERVER_HOST} 'sudo tar -xzf /tmp/pet-garden-webroot-backup.tgz -C ${WEBROOT}'"
  exit 1
fi

echo "✅ 部署完成且校验通过：${SITE_URL}"
