import type { Request, Response, NextFunction } from "express";

// Create a product.
export const createProduct = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to create a product, and if an error occurs, passes the error to the error handler.
};

// Read all products.
export const getProducts = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read the products, and if an error occurs, passes the error to the error handler.
};

// Read single product.
export const getProductById = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read a product, and if an error occurs, passes the error to the error handler.
};

// Update a product.
export const updateProduct = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to update a product, and if an error occurs, passes the error to the error handler.
};

// Delete a product.
export const deleteProduct = (req: Request, res: Response, next: NextFunction) => {
    // Attempts to delete a product, and if an error occurs, passes the error to the next function.
};