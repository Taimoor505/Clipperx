// Builds the static frontend for the desktop app (see CLIPPERX_DESKTOP in next.config.ts)
// and copies just the site files into desktop/web, which the desktop app serves.
import { execSync } from 'node:child_process';
import { cpSync, existsSync, rmSync } from 'node:fs';

const DESKTOP_PORT = process.env.CLIPPERX_PORT || '47800';
const EXPORT_DIR = '.next-desktop'; // a static export lands in distDir
const WEB_DIR = 'desktop/web';

rmSync(EXPORT_DIR, { recursive: true, force: true });
execSync('npx next build', {
  stdio: 'inherit',
  env: {
    ...process.env,
    CLIPPERX_DESKTOP: '1',
    NEXT_PUBLIC_BACKEND_URL: `http://127.0.0.1:${DESKTOP_PORT}`,
    NEXT_PUBLIC_CLIPPERX_DESKTOP: '1',
  },
});

rmSync(WEB_DIR, { recursive: true, force: true });
for (const item of ['index.html', '404.html', '_next', 'favicon.ico']) {
  if (existsSync(`${EXPORT_DIR}/${item}`)) {
    cpSync(`${EXPORT_DIR}/${item}`, `${WEB_DIR}/${item}`, { recursive: true });
  }
}
console.log(`Desktop frontend ready in ${WEB_DIR}`);
