#!/usr/bin/env node

/**
 * 验证Firebase OAuth配置
 * 通过Firebase Admin SDK检查项目配置
 */

const admin = require('firebase-admin');
const fs = require('fs');

const SERVICE_ACCOUNT_PATH = './secrets/firebase-adminsdk.json';
const PROJECT_ID = 'gen-lang-client-0944935873';

async function verifyFirebaseConfig() {
  console.log('🔍 验证Firebase OAuth配置...\n');

  try {
    // 1. 初始化Firebase Admin
    console.log('1️⃣  初始化Firebase Admin SDK...');
    const serviceAccount = JSON.parse(fs.readFileSync(SERVICE_ACCOUNT_PATH, 'utf8'));
    
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
      projectId: PROJECT_ID,
    });
    
    console.log('   ✅ Firebase Admin已初始化\n');

    // 2. 获取Auth配置
    console.log('2️⃣  获取Firebase Auth配置...');
    const auth = admin.auth();
    
    // 获取项目配置
    const projectConfig = await auth.projectConfigManager().getProjectConfig();
    console.log('   ✅ 项目配置已获取\n');

    // 3. 检查OAuth提供商
    console.log('3️⃣  检查OAuth提供商配置...');
    
    // 注意: Firebase Admin SDK不直接提供OAuth客户端配置
    // 我们需要检查其他方式
    
    console.log('   ℹ️  Firebase Admin SDK限制:');
    console.log('   - 无法直接获取OAuth客户端配置');
    console.log('   - 需要通过Firebase Console或GCP Console检查\n');

    // 4. 提供检查清单
    console.log('4️⃣  OAuth配置检查清单:\n');
    
    console.log('   📋 Google Cloud Console检查:');
    console.log('   1. 访问: https://console.cloud.google.com/apis/credentials?project=' + PROJECT_ID);
    console.log('   2. 找到OAuth 2.0客户端ID: 644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com');
    console.log('   3. 点击编辑');
    console.log('   4. 检查"授权的重定向URI"是否包含:');
    console.log('      ✅ https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler');
    console.log('');
    
    console.log('   📋 Firebase Console检查:');
    console.log('   1. 访问: https://console.firebase.google.com/project/' + PROJECT_ID + '/authentication/providers');
    console.log('   2. 检查Google登录是否已启用');
    console.log('   3. 检查授权域名是否包含:');
    console.log('      ✅ www.urlchecker.dev');
    console.log('      ✅ gen-lang-client-0944935873.firebaseapp.com');
    console.log('');

    // 5. 测试Auth Handler可访问性
    console.log('5️⃣  测试Auth Handler可访问性...');
    const https = require('https');
    
    const authHandlerUrl = 'https://gen-lang-client-0944935873.firebaseapp.com/__/auth/handler';
    
    https.get(authHandlerUrl, (res) => {
      if (res.statusCode === 200) {
        console.log('   ✅ Auth Handler可访问 (状态码: 200)');
      } else {
        console.log(`   ⚠️  Auth Handler返回状态码: ${res.statusCode}`);
      }
      console.log('');
      
      // 6. 总结
      console.log('6️⃣  配置验证总结:\n');
      console.log('   ✅ Firebase Admin SDK正常');
      console.log('   ✅ Auth Handler可访问');
      console.log('   ⚠️  OAuth重定向URI需要手动验证\n');
      
      console.log('   🔧 如果登录仍然失败，请确认:');
      console.log('   1. OAuth重定向URI配置正确');
      console.log('   2. 等待2-5分钟让配置生效');
      console.log('   3. 清除浏览器缓存');
      console.log('   4. 重新测试登录流程\n');
      
      process.exit(0);
    }).on('error', (error) => {
      console.log('   ❌ Auth Handler不可访问:', error.message);
      console.log('');
      process.exit(1);
    });

  } catch (error) {
    console.error('❌ 错误:', error.message);
    if (error.stack) {
      console.error('   Stack:', error.stack);
    }
    process.exit(1);
  }
}

// 运行验证
verifyFirebaseConfig().catch(console.error);
