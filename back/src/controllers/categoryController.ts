import type { Request, Response, NextFunction } from "express";
import { db } from "../config/firebase";

// Create a category.
export const createCategory = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to create a category, and if an error occurs, passes the error to the error handler.
    try {
        const { categoria } = req.body;

        // Verifying that the received data is valid.
        if (!categoria) {
            return res.status(400).json({
                success: false,
                error: 'O nome da categoria é obrigatório.'
            });
        }

        // Creating the category object.
        const newCategory = {
            categoria,
        };

        // Checking if the category already exists.
        const categoriesRef = db.collection('categorias');
        const queryRef = await categoriesRef.where('categoria', '==', categoria).limit(1).get();

        if (!queryRef.empty) {
            return res.status(409).json({
                success: false,
                error: 'Categoria já existe.',
            });
        }

        // Saving the category in the database.
        const categoryRef = await categoriesRef.add(newCategory);

        res.status(201).json({
            success: true,
            message: 'Categoria cadastrada com sucesso!',
            categoryId: categoryRef.id,
        });
    } catch (error) {
        next(error);
    }
};

// Read all categories.
export const getCategories = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read the categories, and if an error occurs, passes the error to the error handler.
    try {
        const categoriesSnapshot = await db.collection('categorias').get();

        // Checking if there are categories.
        if (categoriesSnapshot.empty) {
            return res.status(200).json({
                success: true,
                message: 'Nenhuma categoria cadastrada.',
                categories: [],
            });
        }

        // Converting to JS object and returning.
        const categories = categoriesSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json({
            success: true,
            categories,
        });
    } catch (error) {
        next(error);
    }
};

// Update a category.
export const updateCategory = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to update a category, and if an error occurs, passes the error to the error handler.
    try {
        const id = req.params.id;
        const { categoria } = req.body;

        const categoryRef = db.collection('categorias').doc(id);
        const category = await categoryRef.get();

        // Checking if the category with the specified ID exists.
        if (!category.exists) {
            return res.status(404).json({
                success: false,
                error: 'Categoria não encontrada.',
            });
        }

        // Creating a category with updated fields.
        const updatedFields: Record<string, any> = {};
        if (categoria !== undefined) updatedFields.categoria = categoria;

        // Checking if any fields have been filled in.
        if (Object.keys(updatedFields).length == 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum campo para atualização foi enviado.',
            });
        }

        // Updating the database and returning.
        await categoryRef.update({
            ...updatedFields,
        });

        const updatedCategory = await categoryRef.get();

        res.status(200).json({
            success: true,
            message: 'Categoria atualizada com sucesso!',
            category: {
                id: updatedCategory.id,
                ...updatedCategory.data(),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Delete a category.
export const deleteCategory = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to delete a category, and if an error occurs, passes the error to the next function.
    try {
        const id = req.params.id;

        const categoryRef = db.collection('categorias').doc(id);
        const category = await categoryRef.get();

        // Checking if the category with the specified ID exists.
        if (!category.exists) {
            return res.status(404).json({
                success: false,
                error: 'Categoria não encontrada.',
            });
        }

        // Changing the products that belong to this category.
        const data = category.data();
        if (data) {
            const productSnapshot = await db.collection('produtos').where('categoria', '==', data.categoria).get();
            if (!productSnapshot.empty) {
                const batch = db.batch();

                productSnapshot.docs.splice(0, 500).forEach(doc => {
                    batch.update(doc.ref, { categoria: '' });
                })

                await batch.commit();
            }
        }

        // Deleting the category.
        await categoryRef.delete();

        res.status(200).json({
            success: true,
            message: 'Categoria removida com sucesso!',
            deletedCategory: {
                id: category.id,
                ...data,
            },
        });
    } catch (error) {
        next(error);
    }
};