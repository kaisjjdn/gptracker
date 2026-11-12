DROP INDEX "sales_unique";--> statement-breakpoint
ALTER TABLE "sales" ALTER COLUMN "name" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "sales" ADD COLUMN "external_id" text;--> statement-breakpoint
CREATE UNIQUE INDEX "sales_external" ON "sales" USING btree ("store_id","region_id","external_id");