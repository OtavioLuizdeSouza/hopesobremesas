import 'dotenv/config';
import { z } from 'zod';

const optionalCoordinate = (minimum, maximum) => z.preprocess(
  (value) => value === '' || value === undefined ? undefined : value,
  z.coerce.number().min(minimum).max(maximum).optional(),
);

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(32),
  PORT: z.coerce.number().int().positive().default(3000),
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  FRONTEND_DIR: z.string().min(1).optional(),
  GOOGLE_MAPS_API_KEY: z.string().min(1).optional(),
  STORE_LATITUDE: optionalCoordinate(-90, 90),
  STORE_LONGITUDE: optionalCoordinate(-180, 180),
});

export const env = envSchema.parse(process.env);
