import resolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import typescript from '@rollup/plugin-typescript';
import terser from '@rollup/plugin-terser';
import json from '@rollup/plugin-json';
import dts from 'rollup-plugin-dts';
import { defineConfig } from 'rollup';

const external = [
  '@stellar/stellar-sdk',
  'axios',
  'bip39',
  'ed25519-hd-key',
  'tweetnacl',
];

export default defineConfig([
  // ESM build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/esm/index.js',
      format: 'esm',
      sourcemap: true,
    },
    external,
    plugins: [
      json(),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false,
      }),
    ],
  },
  // CJS build
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/cjs/index.cjs',
      format: 'cjs',
      sourcemap: true,
      exports: 'named',
    },
    external,
    plugins: [
      json(),
      resolve(),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false,
      }),
    ],
  },
  // UMD build (browser)
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/umd/wirex-sdk.umd.js',
      format: 'umd',
      name: 'WirexSDK',
      sourcemap: true,
      exports: 'named',
      globals: {
        '@stellar/stellar-sdk': 'StellarSdk',
        'axios': 'axios',
        'bip39': 'bip39',
        'ed25519-hd-key': 'ed25519HdKey',
        'tweetnacl': 'nacl',
      },
    },
    external,
    plugins: [
      json(),
      resolve({ browser: true }),
      commonjs(),
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false,
      }),
      terser(),
    ],
  },
  // Type declarations
  {
    input: 'src/index.ts',
    output: {
      file: 'dist/types/index.d.ts',
      format: 'esm',
    },
    plugins: [dts()],
  },
]);
