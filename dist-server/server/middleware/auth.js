import jwt from 'jsonwebtoken';
import { config } from '../config/env.js';
import User from '../models/User.js';
export const authMiddleware = async (req, res, next) => {
    try {
        let token;
        if (req.headers.authorization &&
            req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }
        if (!token) {
            res.status(401).json({ success: false, message: 'Not authorized, no token' });
            return;
        }
        try {
            const decoded = jwt.verify(token, config.JWT_SECRET);
            const user = await User.findById(decoded.id);
            if (!user) {
                res.status(401).json({ success: false, message: 'User not found' });
                return;
            }
            req.user = user;
            next();
        }
        catch (jwtError) {
            res.status(401).json({ success: false, message: 'Not authorized, invalid token' });
            return;
        }
    }
    catch (error) {
        console.error('Auth middleware error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
        return;
    }
};
export const adminMiddleware = (req, res, next) => {
    if (req.user && req.user.role === 'admin') {
        next();
    }
    else {
        res.status(403).json({
            success: false,
            message: 'Not authorized, admin access required',
        });
    }
};
