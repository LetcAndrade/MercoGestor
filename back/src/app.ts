import express from "express";
import type { Application } from "express";

import { errorHandler } from "./middlewares/errorHandler";
import config from "./config/config";
import cors from "cors";
import products from "./routes/productRoutes";

const app: Application = express();

// Middlewares.
app.use(cors({
    origin: config.frontendUrl,
}));
app.use(express.json());

// Routes.
app.use("/api/products", products);

// Custom error handler.
app.use(errorHandler);

export default app;