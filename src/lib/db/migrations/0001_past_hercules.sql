ALTER TYPE "public"."user_role" ADD VALUE IF NOT EXISTS 'guest';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;
