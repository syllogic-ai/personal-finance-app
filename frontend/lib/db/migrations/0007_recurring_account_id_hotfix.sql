ALTER TABLE "recurring_transactions"
	ADD COLUMN IF NOT EXISTS "account_id" uuid;

DO $$
BEGIN
	IF NOT EXISTS (
		SELECT 1
		FROM pg_constraint
		WHERE conname = 'recurring_transactions_account_id_accounts_id_fk'
	) THEN
		ALTER TABLE "recurring_transactions"
			ADD CONSTRAINT "recurring_transactions_account_id_accounts_id_fk"
			FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE set null ON UPDATE no action;
	END IF;
END $$;

CREATE INDEX IF NOT EXISTS "idx_recurring_transactions_account" ON "recurring_transactions" USING btree ("account_id");
