#!/usr/bin/env node

/**
 * Google OAuth配置检查脚本
 * 检查Google Cloud Console中的OAuth 2.0配置
 */

const https = require('https');

const PROJECT_ID = 'gen-lang-client-0944935873';
const CLIENT_ID = '644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com';

const REQUIRED_ORIGINS = [
  'https://www.urlchecker.dev',
  'https://urlchecker.dev',
  'https://gen-lang-client-0944935873.firebaseapp.com'
];

const REQUIRED_REDIRECT_URIS = [
  'https://www.urlchecker.dev/__/auth/handler',
  'https://urlchecker.dev/__/auth/handler',
  'https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler'
];

async function checkGoogleOAuthConfig() {
  console.log('🔍 检查Google OAuth配置...\n');

  console.log('1️⃣ 项目信息:');
  console.log(`   📋 Project ID: ${PROJECT_ID}`);
  console.log(`   📋 Client ID: ${CLIENT_ID}`);
  console.log('');

  console.log('2️⃣ 必需的授权JavaScript来源:');
  REQUIRED_ORIGINS.forEach(origin => {
    console.log(`   🔗 ${origin}`);
  });
  console.log('');

  console.log('3️⃣ 必需的授权重定向URI:');
  REQUIRED_REDIRECT_URIS.forEach(uri => {
    console.log(`   🔗 ${uri}`);
  });
  console.log('');

  console.log('4️⃣ 配置检查步骤:');
  console.log('   1. 访问 Google Cloud Console:');
  console.log(`      https://console.cloud.google.com/apis/credentials?project=${PROJECT_ID}`);
  console.log('');
  console.log('   2. 找到OAuth 2.0客户端ID:');
  console.log(`      Client ID: ${CLIENT_ID}`);
  console.log('');
  console.log('   3. 点击编辑，检查以下配置:');
  console.log('');
  console.log('   📋 授权的JavaScript来源 (Authorized JavaScript origins):');
  REQUIRED_ORIGINS.forEach(origin => {
    console.log(`      ✅ ${origin}`);
  });
  console.log('');
  console.log('   📋 授权的重定向URI (Authorized redirect URIs):');
  REQUIRED_REDIRECT_URIS.forEach(uri => {
    console.log(`      ✅ ${uri}`);
  });
  console.log('');

  console.log('5️⃣ 测试Google OAuth流程:');
  console.log('   1. 访问登录页面: https://www.urlchecker.dev/auth/sign-in');
  console.log('   2. 点击Google登录按钮');
  console.log('   3. 观察浏览器控制台的错误信息');
  console.log('   4. 检查Network面板中的请求状态');
  console.log('');

  console.log('6️⃣ 常见错误及解决方案:');
  console.log('   ❌ "unauthorized_client" 错误:');
  console.log('      → 检查Client ID是否正确');
  console.log('      → 检查授权来源是否包含当前域名');
  console.log('');
  console.log('   ❌ "redirect_uri_mismatch" 错误:');
  console.log('      → 检查重定向URI配置');
  console.log('      → 确保包含 /__/auth/handler 路径');
  console.log('');
  console.log('   ❌ "access_denied" 错误:');
  console.log('      → 用户取消授权（正常行为）');
  console.log('      → 检查OAuth同意屏幕配置');
  console.log('');

  // 尝试检查OAuth配置的可访问性
  console.log('7️⃣ OAuth端点可访问性检查:');
  try {
    await checkOAuthEndpoint();
    console.log('   ✅ Google OAuth端点可访问');
  } catch (error) {
    console.log(`   ❌ Google OAuth端点访问失败: ${error.message}`);
  }
  console.log('');

  console.log('✅ 检查完成！');
  console.log('');
  console.log('🚀 下一步操作:');
  console.log('1. 登录Google Cloud Console验证OAuth配置');
  console.log('2. 确保所有必需的来源和重定向URI都已添加');
  console.log('3. 保存配置更改');
  console.log('4. 等待几分钟让配置生效');
  console.log('5. 重新测试Google登录功能');
}

function checkOAuthEndpoint() {
  return new Promise((resolve, reject) => {
    const url = 'https://accounts.google.com/o/oauth2/auth';
    
    https.get(url, (response) => {
      if (response.statusCode === 200 || response.statusCode === 400) {
        // 400是正常的，因为我们没有提供必需的参数
        resolve(response.statusCode);
      } else {
        reject(new Error(`HTTP ${response.statusCode}`));
      }
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// 运行检查
checkGoogleOAuthConfig().catch(console.error);