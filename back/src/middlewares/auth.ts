import type { Request, Response, NextFunction } from "express";
import type { DecodedIdToken } from "firebase-admin/auth";
import { auth } from "../config/firebase";

declare global {
    namespace Express {
        interface Request {
            user?: DecodedIdToken
        }
    }
}

export const verifyToken = async (req: Request, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({
            success: false,
            error: 'Token não informado.',
        });
    }

    const token = authHeader.split(' ')[1] || '';

    try {
        const decoded = await auth.verifyIdToken(token);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Token inválido.',
        });
    }
}