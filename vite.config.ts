import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
// image optimizer removed (sharp build issues on ARM Mac)

const assetPrefix = 'lib'

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		tsconfigPaths(),
	],
	build: {
		outDir: 'dist',
		sourcemap: true,
		rollupOptions: {
			output: {
				hashCharacters: 'base36',
				chunkFileNames: `${assetPrefix}/[hash].js`,
				entryFileNames: `${assetPrefix}/[hash].js`,
				assetFileNames(chunkInfo) {
					if (chunkInfo.names.some(x => x.endsWith('.css'))) {
						return `${assetPrefix}/[hash].[ext]`
					}
					if (chunkInfo.names.some(x => x.endsWith('.jpg') || x.endsWith('.jpeg'))) {
						return `${assetPrefix}/[hash].jpeg`
					}
					return `${assetPrefix}/[hash].[ext]`
				},
				manualChunks(id) {
					if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) return 'react-vendor'
					if (id.includes('node_modules/@tanstack')) return 'router-vendor'
				},
			},
		},
	},
	server: {
		port: parseInt(process.env.PORT || '4000'),
		proxy: {
			'/api': {
				target: `http://localhost:${process.env.WORKER_PORT || '8787'}`,
				changeOrigin: true,
			},
		},
	},
	preview: {
		port: parseInt(process.env.PORT || '4000'),
	},
})
