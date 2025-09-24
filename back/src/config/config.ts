import dotenv from "dotenv";

dotenv.config();

interface Config {
    frontendUrl: string,
    port: number,
};

const config: Config = {
    frontendUrl: process.env.URL || "http://localhost:3001",
    port: Number(process.env.PORT) || 3000,
};

export default config;