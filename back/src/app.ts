import express from "express";
import type { Application } from "express";

import { errorHandler } from "./middlewares/errorHandler";
import config from "./config/config";
import cors from "cors";
import router from "./routes/index";

const app: Application = express();

// Middlewares.
app.use(cors({
    origin: config.frontendUrl,
}));
app.use(express.json());

// Routes.
app.use("/api", router);

// Custom error handler.
app.use(errorHandler);

export default app;