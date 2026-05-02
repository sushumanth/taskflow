import dotenv from 'dotenv';
import path from 'path';
// Load .env from project root (works both in dev and production)
const envPath = path.join(process.cwd(), 'server', '.env');
dotenv.config({ path: envPath });
export const config = {
    PORT: process.env.PORT || 5000,
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/taskforge',
    JWT_SECRET: process.env.JWT_SECRET || 'taskforge_secret',
    JWT_EXPIRES_IN: (process.env.JWT_EXPIRES_IN || '7d'),
    NODE_ENV: process.env.NODE_ENV || 'development',
};
