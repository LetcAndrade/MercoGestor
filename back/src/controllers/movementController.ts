import type { Request, Response, NextFunction } from "express";
import { db } from '../config/firebase';

// Create a movement.
export const createMovement = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to create a movement, and if an error occurs, passes the error to the error handler.
    try {
        const { productId, tipo, quantidade, dataISO, precoUnitario, validadeLote, motivo } = req.body;

        // Verifying that the received data is valid.
        if (!productId || !tipo || !quantidade || !dataISO) {
            return res.status(400).json({
                success: false,
                error: 'ID do produto, tipo, quantidade e data são obrigatórios.',
            });
        }

        // Checking if the product exists.
        const product = await db.collection('produtos').doc(productId).get();
        if (!product.exists) {
            return res.status(400).json({
                success: false,
                error: 'O código do produto deve referenciar um produto existente.',
            });
        }

        // Creating the movement object.
        const newMovement = {
            productId,
            tipo,
            quantidade: parseFloat(quantidade),
            dataISO,
            precoUnitario: parseFloat(precoUnitario) ?? null,
            validadeLote: validadeLote ?? null,
            motivo: motivo ?? null,
        };

        // Saving the movement in the database.
        const movementRef = await db.collection('movimentos').add(newMovement);

        res.status(201).json({
            success: true,
            message: 'Movimento cadastrado com sucesso.',
            movementId: movementRef.id,
        });
    } catch (error) {
        next(error);
    }
};

// Read all movements.
export const getMovements = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read the movements, and if an error occurs, passes the error to the error handler.
    try {
        const { tipo, inicio, fim } = req.query;

        // Filtering movements.
        let queryRef: FirebaseFirestore.Query = db.collection('movimentos');
        if (tipo && tipo != 'all') {
            queryRef = queryRef.where('tipo', '==', tipo);
        }

        if (inicio && fim) {
            queryRef = queryRef.where('dataISO', '>=', inicio).where('dataISO', '<=', fim);
        }

        // Checking if there are movements.
        const movementsSnapshot = await queryRef.get();
        if (movementsSnapshot.empty) {
            return res.status(200).json({
                success: true,
                message: 'Nenhuma movimentação cadastrada.',
                movements: [],
            });
        }

        // Converting to JS object and returning.
        const movements = movementsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json({
            success: true,
            movements
        });
    } catch (error) {
        next(error);
    }
};

// Read single movement.
export const getMovementById = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to read a movement, and if an error occurs, passes the error to the error handler.
    try {
        const id = req.params.id;
        const movement = await db.collection('movimentos').doc(id).get();

        // Checking if the movement with the specified ID exists.
        if (!movement.exists) {
            return res.status(404).json({
                success: false,
                error: 'Movimento não encontrado.',
            });
        }

        res.status(200).json({
            success: true,
            movement: {
                id: movement.id,
                ...movement.data(),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Update a movement.
export const updateMovement = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to update a movement, and if an error occurs, passes the error to the error handler.
    try {
        const id = req.params.id;
        const { productId, tipo, quantidade, dataISO, precoUnitario, validadeLote, motivo } = req.body;

        const movementRef = db.collection('movimentos').doc(id);
        const movement = await movementRef.get()

        // Checking if the movement with the specified ID exists.
        if (!movement.exists) {
            return res.status(404).json({
                success: false,
                error: 'Movimento não encontrado.',
            });
        }

        // Creating a movement with updated fields.
        const updatedFields: Record<string, any> = {};
        if (productId !== undefined) updatedFields.productId = productId;
        if (tipo !== undefined) updatedFields.tipo = tipo;
        if (quantidade !== undefined) updatedFields.quantidade = parseFloat(quantidade);
        if (dataISO !== undefined) updatedFields.dataISO = dataISO;
        if (precoUnitario !== undefined) updatedFields.precoUnitario = parseFloat(precoUnitario);
        if (validadeLote !== undefined) updatedFields.validadeLote = validadeLote;
        if (motivo !== undefined) updatedFields.motivo = motivo;

        // Checking if any fields have been filled in.
        if (Object.keys(updatedFields).length == 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum campo para atualização foi enviado.',
            });
        }

        // Checking if the product exists.
        if (productId) {
            const product = await db.collection('produtos').doc(productId).get();
            if (!product.exists) {
                return res.status(400).json({
                    success: false,
                    error: 'O código do produto deve referenciar um produto existente.',
                });
            }
        }

        // Updating the database and returning.
        await movementRef.update({
            ...updatedFields,
        });

        const updatedMovement = await movementRef.get();

        res.status(200).json({
            success: true,
            message: 'Movimento atualizado com sucesso!',
            product: {
                id: updatedMovement.id,
                ...updatedMovement.data(),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Delete a movement.
export const deleteMovement = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to delete a movement, and if an error occurs, passes the error to the next function.
    try {
        const id = req.params.id;

        const movementRef = db.collection('movimentos').doc(id);
        const movement = await movementRef.get();

        // Checking if the movement with the specified ID exists.
        if (!movement.exists) {
            return res.status(404).json({
                success: false,
                error: 'Movimento não encontrado.',
            });
        }

        // Deleting the movement.
        await movementRef.delete();

        res.status(200).json({
            success: true,
            message: 'Movimento removido com sucesso!',
            deletedMovement: {
                id: movement.id,
                ...movement.data(),
            },
        });
    } catch (error) {
        next(error);
    }
};