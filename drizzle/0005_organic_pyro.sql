CREATE TABLE "discovered_games" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"ps_concept_id" text,
	"eshop_id" text,
	"xbox_product_id" text,
	"source" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "discovered_games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "discovery_seen" (
	"id" serial PRIMARY KEY NOT NULL,
	"store" text NOT NULL,
	"key" text NOT NULL,
	"outcome" text NOT NULL,
	"note" text,
	"seen_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "discovery_seen_key" ON "discovery_seen" USING btree ("store","key");