import type { Request, Response, NextFunction } from "express";

export interface AppError extends Error {
    status?: number,
};

export const errorHandler = (err: AppError, req: Request, res: Response, next: NextFunction) => {
    // If the headers have already been sent to a client, the default error handler should be invoked.
    if (res.headersSent) {
        return next(err);
    }

    // A simple answer.
    res.status(err.status || 500).json({ message: err.message || "Internal Server Error", });
};
