import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uncoverroadsapp.travel',
  appName: 'Uncover Roads',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
