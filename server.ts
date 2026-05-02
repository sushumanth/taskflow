import express from 'express';
import cors from 'cors';
import { config } from './server/config/env.ts';
import { connectDB } from './server/config/db.ts';
import { errorHandler } from './server/middleware/errorHandler.ts';
import authRoutes from './server/routes/auth.ts';
import projectRoutes from './server/routes/projects.ts';
import taskRoutes from './server/routes/tasks.ts';
import dashboardRoutes from './server/routes/dashboard.ts';

const app = express();

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, message: 'TaskForge API is running' });
});

// Error handler
app.use(errorHandler);

// Handle 404
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

const PORT = config.PORT;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

export default app;
