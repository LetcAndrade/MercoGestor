import { Router } from "express";
import { createCategory, getCategories, updateCategory, deleteCategory } from "../controllers/categoryController";

const router: Router = Router();

// Category routes.
router.post('/', createCategory);

router.get('/', getCategories);

router.put('/:id', updateCategory);

router.delete('/:id', deleteCategory);

export default router;