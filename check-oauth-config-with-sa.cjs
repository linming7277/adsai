#!/usr/bin/env node

/**
 * 使用服务账号检查OAuth配置
 */

const https = require('https');
const fs = require('fs');
const { JWT } = require('google-auth-library');

const SERVICE_ACCOUNT_PATH = './secrets/gcp_codex_dev.json';
const PROJECT_ID = 'your-gcp-project-id';
const OAUTH_CLIENT_ID = '644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com';

async function checkOAuthConfig() {
  console.log('🔍 使用服务账号检查OAuth配置...\n');

  try {
    // 1. 读取服务账号密钥
    console.log('1️⃣  读取服务账号密钥...');
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    console.log(`   ✅ 服务账号: ${serviceAccount.client_email}\n`);

    // 2. 创建JWT客户端
    console.log('2️⃣  创建JWT客户端...');
    const client = new JWT({
      email: serviceAccount.client_email,
      key: serviceAccount.private_key,
      scopes: ['https://www.googleapis.com/auth/cloud-platform'],
    });

    // 3. 获取访问令牌
    console.log('3️⃣  获取访问令牌...');
    const tokens = await client.authorize();
    console.log('   ✅ 访问令牌已获取\n');

    // 4. 获取OAuth客户端配置
    console.log('4️⃣  获取OAuth客户端配置...');
    const oauthConfig = await getOAuthClientConfig(tokens.access_token);
    
    if (oauthConfig) {
      console.log('   ✅ OAuth配置已获取\n');
      
      // 5. 检查重定向URI
      console.log('5️⃣  检查重定向URI配置...');
      const redirectUris = oauthConfig.web?.redirect_uris || [];
      
      console.log('   📋 当前配置的重定向URI:');
      redirectUris.forEach(uri => {
        console.log(`      - ${uri}`);
      });
      console.log('');
      
      // 6. 验证必需的URI
      const requiredUri = 'https://your-gcp-project-id.firebaseapp.com/__/auth/handler';
      const hasRequiredUri = redirectUris.includes(requiredUri);
      
      console.log('6️⃣  验证必需的重定向URI...');
      console.log(`   必需URI: ${requiredUri}`);
      
      if (hasRequiredUri) {
        console.log('   ✅ 配置正确！\n');
      } else {
        console.log('   ❌ 缺少必需的重定向URI！\n');
        console.log('   🔧 需要添加的URI:');
        console.log(`      ${requiredUri}\n`);
      }
      
      // 7. 检查授权来源
      console.log('7️⃣  检查授权的JavaScript来源...');
      const origins = oauthConfig.web?.javascript_origins || [];
      
      console.log('   📋 当前配置的来源:');
      origins.forEach(origin => {
        console.log(`      - ${origin}`);
      });
      console.log('');
      
    } else {
      console.log('   ❌ 无法获取OAuth配置\n');
    }

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.response) {
      console.error('   响应:', error.response.data);
    }
  }
}

async function getOAuthClientConfig(accessToken) {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'oauth2.googleapis.com',
      path: `/v2/oauth2/v2/userinfo`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    };

    // 注意: Google OAuth2 API不直接提供获取客户端配置的端点
    // 我们需要使用Cloud Console API或者手动检查
    console.log('   ⚠️  注意: OAuth客户端配置需要通过Cloud Console手动检查');
    console.log('   🔗 访问: https://console.cloud.google.com/apis/credentials?project=' + PROJECT_ID);
    resolve(null);
  });
}

// 运行检查
checkOAuthConfig().catch(console.error);
