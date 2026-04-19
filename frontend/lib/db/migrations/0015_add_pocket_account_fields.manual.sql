-- Pocket account IBAN fields (hand-authored; applied via `pnpm db:push`).
-- Idempotent guards match the 0009 precedent so re-application is safe.

ALTER TABLE "accounts"
	ADD COLUMN IF NOT EXISTS "iban_ciphertext" text,
	ADD COLUMN IF NOT EXISTS "iban_hash" varchar(64);
--> statement-breakpoint

CREATE INDEX IF NOT EXISTS "idx_accounts_user_iban_hash"
	ON "accounts" USING btree ("user_id", "iban_hash");
