#!/usr/bin/env node

/**
 * 测试OAuth重定向URI配置
 * 通过模拟OAuth流程来验证配置
 */

const https = require('https');
const { URL } = require('url');

const PROJECT_ID = 'gen-lang-client-0944935873';
const CLIENT_ID = '644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com';
const REDIRECT_URI = `https://${PROJECT_ID}.firebaseapp.com/__/auth/handler`;

async function testOAuthRedirectUri() {
  console.log('🔍 测试OAuth重定向URI配置...\n');

  console.log('📋 配置信息:');
  console.log(`   Project ID: ${PROJECT_ID}`);
  console.log(`   Client ID: ${CLIENT_ID}`);
  console.log(`   Redirect URI: ${REDIRECT_URI}\n`);

  // 1. 测试Auth Handler可访问性
  console.log('1️⃣  测试Auth Handler可访问性...');
  const authHandlerAccessible = await testAuthHandler(REDIRECT_URI);
  
  if (authHandlerAccessible) {
    console.log('   ✅ Auth Handler可访问\n');
  } else {
    console.log('   ❌ Auth Handler不可访问\n');
    return;
  }

  // 2. 构造OAuth授权URL
  console.log('2️⃣  构造OAuth授权URL...');
  const authUrl = buildOAuthUrl(CLIENT_ID, REDIRECT_URI);
  console.log(`   URL: ${authUrl.substring(0, 100)}...\n`);

  // 3. 测试OAuth端点
  console.log('3️⃣  测试Google OAuth端点...');
  const oauthEndpointWorks = await testOAuthEndpoint(authUrl);
  
  if (oauthEndpointWorks) {
    console.log('   ✅ OAuth端点响应正常\n');
  } else {
    console.log('   ❌ OAuth端点响应异常\n');
  }

  // 4. 验证重定向URI格式
  console.log('4️⃣  验证重定向URI格式...');
  const uriValid = validateRedirectUri(REDIRECT_URI);
  
  if (uriValid) {
    console.log('   ✅ 重定向URI格式正确\n');
  } else {
    console.log('   ❌ 重定向URI格式错误\n');
  }

  // 5. 总结
  console.log('5️⃣  配置验证总结:\n');
  
  if (authHandlerAccessible && oauthEndpointWorks && uriValid) {
    console.log('   ✅ 所有基础检查通过\n');
    console.log('   ⚠️  但是，OAuth重定向URI配置需要在Google Cloud Console中手动确认:\n');
    console.log('   📋 检查步骤:');
    console.log('   1. 访问: https://console.cloud.google.com/apis/credentials?project=' + PROJECT_ID);
    console.log('   2. 找到OAuth 2.0客户端ID并点击编辑');
    console.log('   3. 在"授权的重定向URI"中确认包含:');
    console.log(`      ${REDIRECT_URI}`);
    console.log('   4. 如果没有，添加并保存');
    console.log('   5. 等待2-5分钟让配置生效\n');
    
    console.log('   🧪 测试方法:');
    console.log('   1. 清除浏览器缓存');
    console.log('   2. 访问: https://www.urlchecker.dev/auth/sign-in');
    console.log('   3. 点击Google登录');
    console.log('   4. 观察是否成功授权并返回\n');
  } else {
    console.log('   ❌ 基础检查未通过，请先解决上述问题\n');
  }
}

function buildOAuthUrl(clientId, redirectUri) {
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state: 'test_state_' + Date.now(),
  });
  
  return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
}

function testAuthHandler(url) {
  return new Promise((resolve) => {
    https.get(url, (res) => {
      resolve(res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

function testOAuthEndpoint(url) {
  return new Promise((resolve) => {
    const urlObj = new URL(url);
    
    https.get({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method: 'HEAD',
    }, (res) => {
      // Google OAuth应该返回302或200
      resolve(res.statusCode === 302 || res.statusCode === 200);
    }).on('error', () => {
      resolve(false);
    });
  });
}

function validateRedirectUri(uri) {
  try {
    const url = new URL(uri);
    
    // 检查协议
    if (url.protocol !== 'https:') {
      console.log('   ❌ 必须使用HTTPS协议');
      return false;
    }
    
    // 检查域名
    if (!url.hostname.endsWith('.firebaseapp.com') && !url.hostname.endsWith('.web.app')) {
      console.log('   ⚠️  建议使用firebaseapp.com或web.app域名');
    }
    
    // 检查路径
    if (url.pathname !== '/__/auth/handler') {
      console.log('   ❌ 路径必须是 /__/auth/handler');
      return false;
    }
    
    return true;
  } catch (error) {
    console.log('   ❌ URI格式无效:', error.message);
    return false;
  }
}

// 运行测试
testOAuthRedirectUri().catch(console.error);
