#!/bin/bash

# 获取OAuth客户端配置
PROJECT_ID="gen-lang-client-0944935873"
CLIENT_ID="644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com"

echo "🔍 获取OAuth客户端配置..."
echo ""

# 获取访问令牌
echo "1️⃣  获取访问令牌..."
ACCESS_TOKEN=$(gcloud auth print-access-token)

if [ -z "$ACCESS_TOKEN" ]; then
    echo "❌ 无法获取访问令牌"
    exit 1
fi

echo "✅ 访问令牌已获取"
echo ""

# 尝试获取OAuth客户端配置
echo "2️⃣  获取OAuth客户端配置..."

# 使用OAuth2 API
RESPONSE=$(curl -s -H "Authorization: Bearer $ACCESS_TOKEN" \
    "https://www.googleapis.com/oauth2/v1/tokeninfo?access_token=$ACCESS_TOKEN")

echo "访问令牌信息:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# 尝试列出项目中的OAuth客户端
echo "3️⃣  尝试列出OAuth客户端..."

# 注意: Google Cloud Platform没有公开的API来列出OAuth客户端配置
# 需要使用Cloud Console或者特定的API

echo "⚠️  Google Cloud Platform限制:"
echo "   - OAuth客户端配置不能通过标准API获取"
echo "   - 需要通过Cloud Console手动检查"
echo ""

echo "📋 请手动检查以下配置:"
echo ""
echo "1. 访问 Google Cloud Console:"
echo "   https://console.cloud.google.com/apis/credentials?project=$PROJECT_ID"
echo ""
echo "2. 找到OAuth 2.0客户端ID:"
echo "   $CLIENT_ID"
echo ""
echo "3. 点击编辑，检查'授权的重定向URI'是否包含:"
echo "   ✅ https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler"
echo ""
echo "4. 如果没有，请添加并保存"
echo ""
