#!/usr/bin/env bash
# 앱을 Supabase Storage에 올려 배포한다.
#
#   SUPABASE_SERVICE_KEY=... ./scripts/deploy-supabase.sh
#
# 서비스 키는 Supabase 대시보드 → Project Settings → API Keys 에서 확인한다.
# (공개 anon 키로는 쓰기가 막혀 있다 — 읽기 전용 버킷이다)
set -euo pipefail

URL="${SUPABASE_URL:-https://fgravvpnzvjfwgeqolhl.supabase.co}"
KEY="${SUPABASE_SERVICE_KEY:?SUPABASE_SERVICE_KEY 환경변수가 필요합니다}"

npm run build:single

curl -fsS -X POST "$URL/storage/v1/object/site/index.html" \
  -H "apikey: $KEY" \
  -H "Authorization: Bearer $KEY" \
  -H "Content-Type: text/html; charset=utf-8" \
  -H "x-upsert: true" \
  --data-binary @dist-single/index.html > /dev/null

echo "배포 완료 → $URL/functions/v1/app"
echo "(엣지 함수 캐시 때문에 최대 1분 뒤 반영됩니다)"
