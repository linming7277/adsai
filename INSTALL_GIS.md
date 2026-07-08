# 🚀 安装 Google Identity Services

## 📦 步骤1: 安装依赖

```bash
cd apps/frontend
npm install google-auth-library
```

## 📝 步骤2: 更新登录页面

需要修改 `apps/frontend/src/app/auth/sign-in/page.tsx` 或相应的登录页面组件，使用新的 `GoogleIdentityButton`。

## 🔧 步骤3: 配置环境变量

确保 `.env.local` 中有：

```bash
NEXT_PUBLIC_GOOGLE_CLIENT_ID=644672509127-sj0oe3shl7nltvn1agiuf1rv2vqgfsuj.apps.googleusercontent.com
```

## 🌐 步骤4: 配置Google Cloud Console

访问: https://console.cloud.google.com/apis/credentials

找到你的OAuth 2.0 Client ID，添加以下授权的JavaScript来源：

- `http://localhost:3000`
- `https://www.urlchecker.dev`
- `https://www.autoads.dev`
- `https://frontend-preview-yt54xvsg5q-an.a.run.app`

## 🧪 步骤5: 测试

```bash
npm run dev
```

访问 http://localhost:3000/auth/sign-in

应该看到Google的标准登录按钮。

---

## 📋 已创建的文件

1. ✅ `apps/frontend/src/pages/api/auth/google-signin.ts` - 后端API
2. ✅ `apps/frontend/src/components/auth/GoogleIdentityButton.tsx` - 前端组件

## 🔄 需要修改的文件

1. 登录页面 - 使用 `GoogleIdentityButton` 替换 `OAuthProviders`
2. `package.json` - 添加 `google-auth-library` 依赖

---

让我帮你完成这些步骤...
