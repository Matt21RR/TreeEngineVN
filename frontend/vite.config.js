import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import commonjs from 'vite-plugin-commonjs';

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    commonjs(),
    tailwindcss(),
    react()
  ],
  //*ktx2-encoder carga su WASM con new URL(..., import.meta.url): el
  //pre-bundling de Vite rompe esa ruta (texturas BC7, ver TexEncode).
  optimizeDeps: { exclude: ["ktx2-encoder"] },
  //*ChaosInterpreter identifica los builders por constructor.name: sin esto
  //el minificado de produccion renombra las clases y rompe esas busquedas.
  //(Vite 8 usa Rolldown/Oxc: la opcion `esbuild.keepNames` no tendria efecto).
  build: { rolldownOptions: { output: { keepNames: true } } },
  
})
