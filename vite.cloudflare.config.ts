import vinext from 'vinext';
import { defineConfig } from 'vite';
import { cloudflare } from '@cloudflare/vite-plugin';

// Public hosting in the owner's Cloudflare account; independent of Sites auth.
export default defineConfig({
  plugins: [
    vinext(),
    cloudflare({
      configPath: './wrangler.cloudflare.json',
      viteEnvironment: { name: 'rsc', childEnvironments: ['ssr'] },
      inspectorPort: false,
    }),
  ],
});
