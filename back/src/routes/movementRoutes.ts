import { Router } from "express";
import { createMovement, getMovements, getMovementById, updateMovement, deleteMovement } from "../controllers/movementController";

const router: Router = Router();

// Product routes.
router.post('/', createMovement);

router.get('/', getMovements);
router.get('/:id', getMovementById);

router.put('/:id', updateMovement);

router.delete('/:id', deleteMovement);

export default router;