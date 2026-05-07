import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uncoverroads.app',
  appName: 'Uncover Roads',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
