# Firebase Auth Domain 修复

## 问题
Secret Manager 中的 `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` 包含换行符，导致 Firebase SDK 构建错误的 URL。

## 修复
移除 Secret Manager 中的换行符：
- 旧值: `www.urlchecker.dev\n`
- 新值: `www.urlchecker.dev`

## 版本
- Secret Manager 版本: 3
- 修复时间: 2025-10-01

## 部署说明
由于环境变量在构建时注入镜像，需要重新构建前端镜像：
```bash
# 推送代码触发构建
git commit --allow-empty -m "chore: rebuild frontend with fixed authDomain"
git push origin main
```
