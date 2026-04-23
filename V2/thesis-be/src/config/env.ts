import dotenv from "dotenv";
import { validateEnv } from "./env.validator";

dotenv.config();

export const env = validateEnv();
