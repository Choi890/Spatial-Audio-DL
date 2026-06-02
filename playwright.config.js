const { defineConfig, devices } = require("@playwright/test");

module.exports = defineConfig({
  testDir: "./tests",
  timeout: 30_000,
  expect: {
    timeout: 5_000
  },
  webServer: {
    command: "python -m uvicorn app:app --host 127.0.0.1 --port 8767",
    url: "http://127.0.0.1:8767/api/health",
    reuseExistingServer: !process.env.CI,
    timeout: 20_000
  },
  use: {
    baseURL: "http://127.0.0.1:8767",
    channel: "chrome",
    trace: "on-first-retry",
    launchOptions: {
      args: ["--autoplay-policy=no-user-gesture-required"]
    }
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] }
    }
  ]
});
