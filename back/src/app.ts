import express from "express";
import type { Application } from "express";

import { errorHandler } from "./middlewares/errorHandler";
import categories from "./routes/categoryRoutes";
import config from "./config/config";
import cors from "cors";
import movements from "./routes/movementRoutes";
import products from "./routes/productRoutes";
import users from "./routes/userRoutes";

const app: Application = express();

// Middlewares.
app.use(cors({
    origin: config.frontendUrl,
}));
app.use(express.json());

// Routes.
app.use("/api/categories", categories);
app.use("/api/movements", movements);
app.use("/api/products", products);
app.use("/api/users", users);

// Custom error handler.
app.use(errorHandler);

export default app;