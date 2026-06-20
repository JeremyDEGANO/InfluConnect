import type { CapacitorConfig } from "@capacitor/cli"

const config: CapacitorConfig = {
  appId: "com.influconnect.app",
  appName: "InfluConnect",
  webDir: "dist",
  server: {
    androidScheme: "https",
  },
}

export default config
