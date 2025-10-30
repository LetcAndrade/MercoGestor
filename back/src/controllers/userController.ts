import type { Request, Response, NextFunction } from "express";
import { db } from "../config/firebase";

type UserRole = 'admin' | 'operador';

const verifyUserPermission = async (uid: string, targetId: string): Promise<{ allowed: boolean, loggedRole: UserRole }> => {
    const userSnap = await db.collection('usuarios').doc(uid).get();
    if (!userSnap.exists) return { allowed: false, loggedRole: 'operador' };

    const loggedRole: UserRole = userSnap.data()?.role ?? 'operador';
    const allowed = uid === targetId || loggedRole === 'admin';
    return { allowed, loggedRole };
};

// Create a user.
export const createUser = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to create a user, and if an error occurs, passes the error to the error handler.
    try {
        // The user must be logged in to have the ID.
        const uid = req.user?.uid;
        if (!uid) {
            return res.status(401).json({
                success: false,
                error: 'Usuário não autenticado.',
            });
        }

        // Verifying that the received data is valid.
        const { nome, role } = req.body;
        if (!nome) {
            return res.status(400).json({
                success: false,
                error: 'Nome é um campo obrigatório.',
            });
        }

        // Creating the user object.
        const newUser = {
            nome,
            role: role ?? 'operador',
        };

        // Checking if the user already exists.
        const usersRef = db.collection('usuarios');

        if ((await usersRef.doc(uid).get()).exists) {
            return res.status(409).json({
                success: false,
                error: 'Usuário já existe.',
            });
        }

        // Saving the user in the database.
        await usersRef.doc(uid).set(newUser);

        res.status(201).json({
            success: true,
            message: 'Usuário cadastrado com sucesso!',
            userId: uid,
        });
    } catch (error) {
        next(error);
    }
}

// Read all users.
export const getUsers = async (req: Request, res: Response, next: NextFunction) => {
    // Attempts to read the users, and if an error occurs, passes the error to the error handler.
    try {
        const usersQuerySnap = await db.collection('usuarios').get();

        // Checking if there are users.
        if (usersQuerySnap.empty) {
            return res.status(200).json({
                success: true,
                message: 'Nenhum usuário cadastrado.',
                users: [],
            });
        }

        // Converting to JS object and returning.
        const users = usersQuerySnap.docs.map(doc => ({
            id: doc.id,
            ...doc.data(),
        }));

        res.status(200).json({
            success: true,
            users,
        });
    } catch (error) {
        next(error);
    }
}

// Read single user.
export const getUserById = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to read a user, and if an error occurs, passes the error to the error handler.
    try {
        const id = req.params.id;
        const userSnap = await db.collection('usuarios').doc(id).get();

        // Checking if the user with the specified ID exists.
        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado.',
            });
        }

        res.status(200).json({
            success: true,
            user: {
                id: userSnap.id,
                ...userSnap.data(),
            },
        });
    } catch (error) {
        next(error);
    }
}

// Update a user.
export const updateUser = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to update a user, and if an error occurs, passes the error to the error handler.
    try {
        // The user must be logged in, and editing will only be allowed if they are admin or the user themselves.
        const id = req.params.id;
        const { allowed, loggedRole } = await verifyUserPermission(req.user?.uid ?? '', id);

        if (!allowed) {
            return res.status(403).json({
                success: false,
                error: 'O usuário só pode editar a si mesmo.',
            });
        }

        // Checking if the user with the specified ID exists.
        const userRef = db.collection('usuarios').doc(id);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado.',
            });
        }

        // Creating a user with updated fields.
        const { nome, role } = req.body;

        const updatedFields: Record<string, any> = {};
        if (nome !== undefined) updatedFields.nome = nome;
        if (role !== undefined && loggedRole == 'admin') updatedFields.role = role;

        // Checking if any fields have been filled in.
        if (Object.keys(updatedFields).length == 0) {
            return res.status(400).json({
                success: false,
                error: 'Nenhum campo para atualização foi enviado.',
            });
        }

        // Updating the database and returning.
        await userRef.update({
            ...updatedFields,
        });

        const updatedUserSnap = await userRef.get();

        res.status(200).json({
            success: true,
            message: 'Usuário atualizado com sucesso!',
            user: {
                id: updatedUserSnap.id,
                ...updatedUserSnap.data(),
            },
        });
    } catch (error) {
        next(error);
    }
};

// Delete a user.
export const deleteUser = async (req: Request<{id: string}>, res: Response, next: NextFunction) => {
    // Attempts to delete a user, and if an error occurs, passes the error to the next function.
    try {
        // The user must be logged in, and deleting will only be allowed if they are admin or the user themselves.
        const id = req.params.id;
        const { allowed } = await verifyUserPermission(req.user?.uid ?? '', id);

        if (!allowed) {
            return res.status(403).json({
                success: false,
                error: 'O usuário só pode deletar a si mesmo.',
            });
        }

        // Checking if the user with the specified ID exists.
        const userRef = db.collection('usuarios').doc(id);
        const userSnap = await userRef.get();

        if (!userSnap.exists) {
            return res.status(404).json({
                success: false,
                error: 'Usuário não encontrado.',
            });
        }

        // Deleting the user.
        const data = userSnap.data();
        await userRef.delete();

        res.status(200).json({
            success: true,
            message: 'Usuário removido com sucesso!',
            deletedUser: {
                id,
                ...data,
            },
        });
    } catch (error) {
        next(error);
    }
};