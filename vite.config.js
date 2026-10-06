import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// GitHub Pages 배포 시에는 워크플로가 --base=/<저장소명>/ 을 넘겨준다.
export default defineConfig({
  plugins: [react()],
});
