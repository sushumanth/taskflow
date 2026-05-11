import fs from 'fs';
import path from 'path';
import multer from 'multer';
import type { Request } from 'express';

type MulterFile = {
  originalname: string;
};

const uploadRoot = path.join(process.cwd(), 'uploads', 'task-updates');
fs.mkdirSync(uploadRoot, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req: Request, _file: MulterFile, cb: (error: Error | null, destination: string) => void) => {
    cb(null, uploadRoot);
  },
  filename: (_req: Request, file: MulterFile, cb: (error: Error | null, filename: string) => void) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9._-]/g, '_');
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniquePrefix}-${safeName}`);
  },
});

export const taskUpdateUpload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});
