import type { Request, Response, NextFunction } from "express";
import { db } from "../config/firebase";

// Create a product.
export const createProduct = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to create a product, and if an error occurs, passes the error to the error handler.
    try {
        const { nome, unidade, minimo, preco, categoria } = req.body;

        // Verifying that the received data is valid.
        if (!nome || !unidade || minimo == undefined) {
            return res.status(400).json({
                success: false,
                error: 'Nome, unidade e quantidade mínima são obrigatórios.',
            });
        }

        // Creating the product object.
        const newProduct = {
            nome: nome,
            unidade: unidade,
            minimo: parseFloat(minimo),
            preco: parseFloat(preco) ?? null,
            categoria: categoria ?? '',
        };

        // Checking if the product already exists.
        const productsRef = db.collection('produtos');
        const productQuerySnap = await productsRef.where('nome', '==', nome).limit(1).get();

        if (!productQuerySnap.empty) {
            return res.status(409).json({
                success: false,
                error: 'Produto já existe.',
            });
        }

        // Checking if the category exists.
        // if (categoria) {
        //     const categoryQuerySnap = await db.collection('categorias').where('categoria', '==', categoria).limit(1).get();
        //     if (categoryQuerySnap.empty) {
        //         return res.status(400).json({
        //             success: false,
        //             error: 'Categoria informada não existe.',
        //         });
        //     }
        // }

        // Saving the product in the database.
        const productRef = await productsRef.add(newProduct);

        res.status(201).json({
            success: true,
            message: 'Produto cadastrado com sucesso!',
            productId: productRef.id,
        });
    } catch (error) {
        next(error);
    }
};

// Read all products.
export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read the products, and if an error occurs, passes the error to the error handler.
    try {
        const productsQuerySnap = await db.collection('produtos').get();

        // Checking if there are products.
        if (productsQuerySnap.empty) {
            return res.status(200).json({
                success: true,
                message: 'Nenhum produto cadastrado.',
                products: [],
            });
        }

        // Converting to JS object and returning.
        const products = productsQuerySnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json({
            success: true,
            products,
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
        const productSnap = await db.collection('produtos').doc(id).get();

        // Checking if the product with the specified ID exists.
        if (!productSnap.exists) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado.',
            });
        }

        res.status(200).json({
            success: true,
            product: {
                id: productSnap.id,
                ...productSnap.data(),
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
        const { nome, unidade, minimo, preco, categoria } = req.body;

        const productRef = db.collection('produtos').doc(id);
        const productSnap = await productRef.get();

        // Checking if the product with the specified ID exists.
        if (!productSnap.exists) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado.',
            });
        }

        // Creating a product with updated fields, and checking if the category exists (if it is specified).
        const updatedFields: Record<string, any> = {};
        if (nome !== undefined) updatedFields.nome = nome;
        if (unidade !== undefined) updatedFields.unidade = unidade;
        if (minimo !== undefined) updatedFields.minimo = parseFloat(minimo);
        if (preco !== undefined) updatedFields.preco = parseFloat(preco);
        if (categoria !== undefined) {
            if (categoria) {
                const categoryQuerySnap = await db.collection('categorias').where('categoria', '==', categoria).limit(1).get();
                if (categoryQuerySnap.empty) {
                    return res.status(400).json({
                        success: false,
                        error: 'Categoria informada não existe.',
                    });
                }
            }

            updatedFields.categoria = categoria;
        }

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

        const updatedProductSnap = await productRef.get();

        res.status(200).json({
            success: true,
            message: 'Produto atualizado com sucesso!',
            product: {
                id: updatedProductSnap.id,
                ...updatedProductSnap.data(),
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
        const productSnap = await productRef.get();

        // Checking if the product with the specified ID exists.
        if (!productSnap.exists) {
            return res.status(404).json({
                success: false,
                error: 'Produto não encontrado.',
            });
        }

        // Deleting all movements with the product.
        const movementsQuerySnap = await db.collection('movimentos').where('productId', '==', id).get();
        if (!movementsQuerySnap.empty) {
            const batch = db.batch();

            movementsQuerySnap.docs.splice(0, 500).forEach(doc => {
                batch.delete(doc.ref);
            });

            await batch.commit();
        }

        // Deleting the product.
        const data = productSnap.data();
        await productRef.delete();

        res.status(200).json({
            success: true,
            message: 'Produto removido com sucesso!',
            deletedProduct: {
                id,
                ...data,
            },
        });
    } catch (error) {
        next(error);
    }
};