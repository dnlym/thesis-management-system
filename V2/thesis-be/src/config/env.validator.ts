import { z } from "zod";

const envSchema = z.object({
  PORT: z.string().default("3000").transform(Number),
  DATABASE_URL: z.string().url(),
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  CORS_ORIGIN: z.string().default("*").transform((val) => val === "*" ? true : val.split(",")),
  JWT_SECRET: z.string().min(10, "JWT_SECRET should be at least 10 characters long"),
  JWT_EXPIRES_IN: z.string().default("1d"),
});

export const validateEnv = () => {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    console.error("❌ Invalid environment variables:", result.error.format());
    process.exit(1);
  }

  return result.data;
};

export type Env = z.infer<typeof envSchema>;
