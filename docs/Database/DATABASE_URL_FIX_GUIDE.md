#!/bin/bash

# DATABASE_URL格式修复脚本
# 将各种数据库URL格式转换为Cloud SQL标准格式

set -e

# 检查必要的環境變數
if [[ -z "$GOOGLE_CLOUD_PROJECT" ]]; then
    echo "❌ GOOGLE_CLOUD_PROJECT not set"
    exit 1
fi

if [[ -z "$GCP_REGION" ]]; then
    echo "❌ GCP_REGION not set"
    exit 1
fi

if [[ -z "$CLOUD_SQL_INSTANCE" ]]; then
    echo "❌ CLOUD_SQL_INSTANCE not set"
    exit 1
fi

if [[ -z "$DATABASE_NAME" ]]; then
    echo "❌ DATABASE_NAME not set"
    exit 1
fi

echo "🔍 Current DATABASE_URL: $DATABASE_URL"

# 生成正确的Cloud SQL URL
CORRECT_URL="postgresql://USER:PASSWORD@/cloudsql:$GOOGLE_CLOUD_PROJECT:$GCP_REGION:$CLOUD_SQL_INSTANCE/$DATABASE_NAME"

echo "💡 Suggested DATABASE_URL: $CORRECT_URL"

# 創建更新命令
echo "📋 To update DATABASE_URL in Secret Manager:"
echo ""
echo "方法1 - 使用gcloud CLI:"
echo "gcloud secrets versions add DATABASE_URL \"$CORRECT_URL\""
echo ""
echo "方法2 - 使用Console:"
echo "1. 访问 Secret Manager"
echo "2. 找到 DATABASE_URL"
echo "3. 点击 '创建新版本'"
echo "4. 粘贴: $CORRECT_URL"
echo ""
echo "方法3 - 使用API:"
echo "curl -X POST -H \"Authorization: Bearer \$(gcloud auth print-access-token)\" \\"
echo "  -H \"Content-Type: application/json\" \\"
echo "  -d '{\"payload\": {\"data\": \"$CORRECT_URL\"}}' \\"
echo "  \"https://secretmanager.googleapis.com/v1/projects/$GOOGLE_CLOUD_PROJECT/secrets:versions\""
echo ""

# 如果环境变量允许直接更新
if [[ "$UPDATE_LOCAL_ENV" == "true" ]]; then
    echo "🔧 Updating local DATABASE_URL..."
    export DATABASE_URL="$CORRECT_URL"
    echo "✅ Local DATABASE_URL updated"
fi

echo "🎯 Migration complete! Next steps:"
echo "1. Update DATABASE_URL in Secret Manager"
echo "2. Redeploy services with new environment variables"
echo "3. Test database connection"

# 测试新URL格式
echo "🔍 Validating new URL format..."
if [[ "$CORRECT_URL" == *"postgresql://"* ]] && [[ "$CORRECT_URL" == *"/cloudsql/"* ]]; then
    echo "✅ New URL format is correct for Cloud SQL"
else
    echo "❌ New URL format validation failed"
fi