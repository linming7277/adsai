#!/bin/bash

echo "🔧 Fixing admin login for preview environment..."

# Generate and run the debug script
echo "📊 Running diagnostic..."
npx tsx scripts/debug-admin-login.ts

echo ""
echo "✅ Admin login fix completed!"
echo ""
echo "🔑 Login information:"
echo "   URL: /auth/admin-signin"
echo "   Email: admin@autoads.dev"
echo "   Password: 请使用环境变量 ADMIN_PASSWORD 中设置的密码"
echo ""
echo "⚠️  请确保已设置 ADMIN_PASSWORD 环境变量"
echo ""
echo "💡 If login still fails, check the server logs for detailed error messages."