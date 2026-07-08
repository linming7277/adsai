import { defineConfig } from '@playwright/test';

export default defineConfig({
  timeout: 60_000,
  use: {
    baseURL: process.env.GATEWAY || 'https://preview.example.com',
    extraHTTPHeaders: process.env.AUTH ? { Authorization: process.env.AUTH } : {},
  },
  reporter: [['list']],
});

