import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.uncoverroads.travel',
  appName: 'Uncover Roads',
  webDir: 'dist',
  server: {
    androidScheme: 'https',
  },
};

export default config;
