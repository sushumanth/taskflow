import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { config } from './config/env.js';
import User from './models/User.js';

const seedDatabase = async () => {
  try {
    console.log('Connecting to MongoDB...');
    await mongoose.connect(config.MONGODB_URI);
    console.log('✓ Connected to MongoDB');

    // Check if admin exists
    const adminExists = await User.findOne({ email: 'admin@taskflow.com' });
    if (adminExists) {
      console.log('✓ Admin user already exists');
      await mongoose.connection.close();
      return;
    }

    // Create admin user
    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash('admin123', salt);

    const admin = await User.create({
      name: 'Admin User',
      email: 'admin@taskflow.com',
      password: hashedPassword,
      role: 'admin',
    });

    console.log('✓ Admin user created successfully!');
    console.log('');
    console.log('📧 Email: admin@taskflow.com');
    console.log('🔑 Password: admin123');
    console.log('');
    console.log('⚠️  Change the password after first login!');

    await mongoose.connection.close();
    console.log('✓ Database connection closed');
  } catch (error) {
    console.error('❌ Seed error:', error);
    process.exit(1);
  }
};

seedDatabase();
