import { Router } from "express";
import { createUser, getUsers, getUserById, updateUser, deleteUser } from "../controllers/userController";
import { verifyToken } from "../middlewares/auth";

const router: Router = Router();

// User routes.
router.post('/', verifyToken, createUser);

router.get('/', getUsers);
router.get('/:id', getUserById);

router.put('/:id', verifyToken, updateUser);

router.delete('/:id', verifyToken, deleteUser);

export default router;