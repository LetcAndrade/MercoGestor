import express from "express";
import type { Application } from "express";

import cors from "cors";
import router from "./routes/index";

const app: Application = express();

app.use(cors());
app.use(express.json());

// Routes.
app.use("/api", router);

export default app;