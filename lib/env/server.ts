import "server-only";

import { cache } from "react";
import { z } from "zod";

const emptyStringToUndefined = <T extends z.ZodTypeAny>(schema: T) =>
  z.preprocess((value) => {
    if (typeof value === "string" && value.trim().length === 0) {
      return undefined;
    }

    return value;
  }, schema.optional());

const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required."),
  DIRECT_URL: emptyStringToUndefined(z.string().min(1)),
  APP_URL: emptyStringToUndefined(z.string().url()),
  APP_TIMEZONE: z.string().default("Asia/Ho_Chi_Minh"),
  SEED_ADMIN_DEFAULT_PASSWORD: emptyStringToUndefined(z.string().min(8)),
  GOOGLE_CLIENT_EMAIL: emptyStringToUndefined(z.string().email()),
  GOOGLE_PRIVATE_KEY: emptyStringToUndefined(z.string().min(1)),
  GOOGLE_CALENDAR_ID: emptyStringToUndefined(z.string().min(1)),
  GOOGLE_IMPERSONATED_USER: emptyStringToUndefined(z.string().email()),
  GOOGLE_DELETE_CANCELLED_EVENTS: z.enum(["true", "false"]).default("false"),
  CRON_SECRET: emptyStringToUndefined(z.string().min(16)),
  VERCEL_URL: emptyStringToUndefined(z.string().min(1)),
  VERCEL_PROJECT_PRODUCTION_URL: emptyStringToUndefined(z.string().min(1)),
  NEXT_PUBLIC_VERCEL_URL: emptyStringToUndefined(z.string().min(1)),
  NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL: emptyStringToUndefined(z.string().min(1)),
});

function withProtocol(value: string) {
  return value.startsWith("http://") || value.startsWith("https://") ? value : `https://${value}`;
}

function formatEnvIssues(issues: z.ZodIssue[]) {
  return issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join("; ");
}

export const getServerEnv = cache(() => {
  const parsed = serverEnvSchema.safeParse(process.env);

  if (!parsed.success) {
    throw new Error(`Invalid server environment: ${formatEnvIssues(parsed.error.issues)}`);
  }

  const env = parsed.data;
  const googleRequiredValues = [env.GOOGLE_CLIENT_EMAIL, env.GOOGLE_PRIVATE_KEY, env.GOOGLE_CALENDAR_ID];
  const googleProvidedCount = googleRequiredValues.filter(Boolean).length;

  if (googleProvidedCount > 0 && googleProvidedCount < googleRequiredValues.length) {
    throw new Error(
      "GOOGLE_CLIENT_EMAIL, GOOGLE_PRIVATE_KEY, and GOOGLE_CALENDAR_ID must be set together.",
    );
  }

  const appUrlValue =
    env.APP_URL ??
    (env.NODE_ENV === "production"
      ? env.VERCEL_PROJECT_PRODUCTION_URL ??
        env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL
      : env.VERCEL_URL ?? env.NEXT_PUBLIC_VERCEL_URL);

  return {
    ...env,
    APP_URL: appUrlValue ? withProtocol(appUrlValue) : "http://localhost:3000",
  };
});

export function getAppUrl() {
  return new URL(getServerEnv().APP_URL);
}
