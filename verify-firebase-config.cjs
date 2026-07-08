#!/usr/bin/env node

/**
 * Firebase配置验证脚本
 * 验证Firebase和Google OAuth配置是否正确
 */

const https = require('https');
const { URL } = require('url');

// 从环境变量或配置文件读取Firebase配置
const FIREBASE_CONFIG = {
  apiKey: 'REDACTED_FIREBASE_API_KEY',
  authDomain: 'gen-lang-client-0944935873.firebaseapp.com',
  projectId: 'gen-lang-client-0944935873',
  storageBucket: 'gen-lang-client-0944935873.firebasestorage.app',
  messagingSenderId: '644672509127',
  appId: '1:644672509127:web:16915686caf4468bce9ae2',
};

const DOMAINS_TO_CHECK = [
  'www.urlchecker.dev',
  'urlchecker.dev',
  'gen-lang-client-0944935873.firebaseapp.com'
];

async function checkFirebaseConfig() {
  console.log('🔍 验证Firebase配置...\n');

  // 1. 验证基本配置
  console.log('1️⃣ 基本配置检查:');
  console.log(`   ✅ Project ID: ${FIREBASE_CONFIG.projectId}`);
  console.log(`   ✅ Auth Domain: ${FIREBASE_CONFIG.authDomain}`);
  console.log(`   ✅ API Key: ${FIREBASE_CONFIG.apiKey ? 'Set' : '❌ Missing'}`);
  console.log(`   ✅ App ID: ${FIREBASE_CONFIG.appId ? 'Set' : '❌ Missing'}`);
  console.log('');

  // 2. 检查Auth Domain可访问性
  console.log('2️⃣ Auth Domain可访问性检查:');
  try {
    await checkDomainAccessibility(FIREBASE_CONFIG.authDomain);
    console.log(`   ✅ ${FIREBASE_CONFIG.authDomain} 可访问`);
  } catch (error) {
    console.log(`   ❌ ${FIREBASE_CONFIG.authDomain} 不可访问: ${error.message}`);
  }
  console.log('');

  // 3. 检查Firebase Auth配置
  console.log('3️⃣ Firebase Auth配置检查:');
  try {
    const authConfig = await checkFirebaseAuthConfig();
    console.log('   ✅ Firebase Auth配置获取成功');
    
    if (authConfig.authorizedDomains) {
      console.log('   📋 授权域名列表:');
      authConfig.authorizedDomains.forEach(domain => {
        console.log(`      - ${domain}`);
      });
      
      // 检查我们的域名是否在授权列表中
      const missingDomains = DOMAINS_TO_CHECK.filter(domain => 
        !authConfig.authorizedDomains.includes(domain)
      );
      
      if (missingDomains.length > 0) {
        console.log('   ⚠️  以下域名未在Firebase控制台中授权:');
        missingDomains.forEach(domain => {
          console.log(`      ❌ ${domain}`);
        });
      } else {
        console.log('   ✅ 所有必需域名都已授权');
      }
    }
  } catch (error) {
    console.log(`   ❌ 无法获取Firebase Auth配置: ${error.message}`);
  }
  console.log('');

  // 4. 检查Google OAuth配置
  console.log('4️⃣ Google OAuth配置建议:');
  console.log('   📋 需要在Google Cloud Console中配置的授权来源:');
  DOMAINS_TO_CHECK.forEach(domain => {
    console.log(`      - https://${domain}`);
  });
  console.log('   📋 需要配置的重定向URI:');
  DOMAINS_TO_CHECK.forEach(domain => {
    console.log(`      - https://${domain}/__/auth/handler`);
  });
  console.log('');

  // 5. 生成测试URL
  console.log('5️⃣ 测试URL:');
  console.log(`   🔗 登录页面: https://www.urlchecker.dev/auth/sign-in`);
  console.log(`   🔗 Firebase配置测试: https://www.urlchecker.dev/test-firebase-config`);
  console.log('');

  console.log('✅ 配置验证完成！');
  console.log('');
  console.log('📋 下一步操作:');
  console.log('1. 确保Firebase控制台中所有域名都已授权');
  console.log('2. 确保Google Cloud Console中OAuth配置完整');
  console.log('3. 重新部署前端应用');
  console.log('4. 使用真实Google账号测试登录');
}

function checkDomainAccessibility(domain) {
  return new Promise((resolve, reject) => {
    const url = `https://${domain}`;
    const request = https.get(url, (response) => {
      resolve(response.statusCode);
    });

    request.on('error', (error) => {
      reject(error);
    });

    request.setTimeout(5000, () => {
      request.destroy();
      reject(new Error('Timeout'));
    });
  });
}

async function checkFirebaseAuthConfig() {
  return new Promise((resolve, reject) => {
    const url = `https://www.googleapis.com/identitytoolkit/v3/relyingparty/getProjectConfig?key=${FIREBASE_CONFIG.apiKey}`;
    
    https.get(url, (response) => {
      let data = '';
      
      response.on('data', (chunk) => {
        data += chunk;
      });
      
      response.on('end', () => {
        try {
          const config = JSON.parse(data);
          resolve(config);
        } catch (error) {
          reject(new Error('Invalid JSON response'));
        }
      });
    }).on('error', (error) => {
      reject(error);
    });
  });
}

// 运行验证
checkFirebaseConfig().catch(console.error);
