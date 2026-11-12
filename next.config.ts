import type { NextConfig } from 'next';

const config: NextConfig = {
  // PGlite ships its own WASM build; keep it out of the server bundle.
  serverExternalPackages: ['@electric-sql/pglite'],
};

export default config;
