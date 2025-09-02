import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { readFileSync, existsSync } from 'fs'
import { join } from 'path'

const useHttps = process.env.USE_HTTPS === 'true' && process.env.NODE_ENV !== 'production';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0',
    port: 3000,
    ...(useHttps && (() => {
      // Try Docker path first, then local path
      const dockerSslPath = '/app/ssl';
      const localSslPath = join(__dirname, '../ssl');
      
      const sslPath = existsSync(dockerSslPath) ? dockerSslPath : localSslPath;
      
      // Only use HTTPS if SSL files actually exist
      if (existsSync(join(sslPath, 'server.key')) && existsSync(join(sslPath, 'server.crt'))) {
        return {
          https: {
            key: readFileSync(join(sslPath, 'server.key')),
            cert: readFileSync(join(sslPath, 'server.crt'))
          }
        };
      }
      return {};
    })())
  }
})
