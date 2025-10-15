import type { Request, Response, NextFunction } from "express";
import { db } from "../config/firebase";

// Create a product.
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to create a product, and if an error occurs, passes the error to the error handler.
    try {
        const { nome, preco, categoria, estoque } = req.body;

        // Verifying that the received data is valid.
        if (!nome || !preco || !categoria) {
            return res.status(400).json({
                success: false,
                error: 'Nome, preço e categoria são obrigatórios.'
            });
        }

        // Creating the product object.
        const newProduct = {
            nome: nome,
            preco: parseFloat(preco),
            categoria: categoria,
            estoque: parseInt(estoque) || 0,
            dataCadastro: new Date()
        };

        // Saving the product in the database.
        const productRef = await db.collection('produtos').add(newProduct);

        res.status(201).json({
            success: true,
            message: 'Produto cadastrado com sucesso!',
            productID: productRef.id
        });
    } catch (error) {
        next(error);
    }
};

// Read all products.
export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read the products, and if an error occurs, passes the error to the error handler.
    try {
        const productsSnapshot = await db.collection('produtos').get();

        // Checking if there are products.
        if (productsSnapshot.empty) {
            return res.status(200).json({
                success: true,
                message: 'Nenhum produto cadastrado.',
                products: [],
            });
        }

        // Converting to JS object and returning.
        const products = productsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json({
            success: true,
            products: products
        });
    } catch (error) {
        next(error);
    }
};

// Read single product.
export const getProductById = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to read a product, and if an error occurs, passes the error to the error handler.
    try {
        const id = req.params.id;
        const product = await db.collection('produtos').doc(id).get();

        // Checking if the product with the specified ID exists.
        if (!product.exists) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado.',
            });
        }

        res.status(200).json({
            success: true,
            product: {
                id: product.id,
                ...product.data(),
            },
        });
    } catch(error) {
        next(error);
    }
};

// Update a product.
export const updateProduct = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to update a product, and if an error occurs, passes the error to the error handler.
    try {
        const id = req.params.id;
        const { nome, preco, categoria, estoque } = req.body;

        const productRef = db.collection('produtos').doc(id);
        const product = await productRef.get();

        // Checking if the product with the specified ID exists.
        if (!product.exists) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado.',
            });
        }

        // Creating a product with updated fields.
        const updatedFields: Record<string, any> = {};
        if (nome !== undefined) updatedFields.nome = nome;
        if (preco !== undefined) updatedFields.preco = parseFloat(preco);
        if (categoria !== undefined) updatedFields.categoria = categoria;
        if (estoque !== undefined) updatedFields.estoque = parseInt(estoque);

        // Checking if any fields have been filled in.
        if (Object.keys(updatedFields).length == 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum campo para atualização foi enviado.',
            });
        }

        // Updating the database and returning.
        await productRef.update({
            ...updatedFields,
        });

        const updatedProduct = await productRef.get();

        res.status(200).json({
            success: true,
            message: 'Produto atualizado com sucesso!',
            product: {
                id: updatedProduct.id,
                ...updatedProduct.data(),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Delete a product.
export const deleteProduct = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to delete a product, and if an error occurs, passes the error to the next function.
    try {
        const id = req.params.id;

        const productRef = db.collection('produtos').doc(id);
        const product = await productRef.get();

        // Checking if the product with the specified ID exists.
        if (!product.exists) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado.',
            });
        }

        // Deleting the product.
        await productRef.delete();

        res.status(200).json({
            success: true,
            message: 'Produto removido com sucesso!',
            deletedProduct: {
                id: product.id,
                ...product.data(),
            },
        });
    } catch (error) {
        next(error);
    }
};