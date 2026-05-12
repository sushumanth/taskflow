import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load .env from common locations so dev/prod and varying CWDs work reliably.
const envCandidates = [
  path.join(process.cwd(), 'server', '.env'),
  path.join(process.cwd(), '.env'),
  path.join(process.cwd(), '..', 'server', '.env'),
];

const envPath = envCandidates.find((candidate) => fs.existsSync(candidate));
dotenv.config(envPath ? { path: envPath } : undefined);

export const config = {
  PORT: process.env.PORT || 5000,
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/taskforge',
  JWT_SECRET: process.env.JWT_SECRET || 'taskforge_secret',
  JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN || '7d') as `${number}${'s' | 'm' | 'h' | 'd'}`,
  NODE_ENV: process.env.NODE_ENV || 'development',
};
