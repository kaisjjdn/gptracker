CREATE TYPE "public"."platform" AS ENUM('ps4', 'ps5', 'switch', 'switch2', 'xbox_one', 'xbox_series');--> statement-breakpoint
CREATE TYPE "public"."price_event_type" AS ENUM('new_listing', 'sale_start', 'sale_end', 'base_price_up', 'base_price_down', 'price_change', 'delisted');--> statement-breakpoint
CREATE TYPE "public"."product_format" AS ENUM('digital', 'disc');--> statement-breakpoint
CREATE TYPE "public"."store_kind" AS ENUM('digital', 'retail');--> statement-breakpoint
CREATE TABLE "games" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"title" text NOT NULL,
	"genre" text,
	"publisher" text,
	"cover_url" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "games_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "listings" (
	"id" serial PRIMARY KEY NOT NULL,
	"product_id" integer NOT NULL,
	"store_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"store_product_id" text NOT NULL,
	"url" text,
	"seller_name" text,
	"note" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_checked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "price_events" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"type" "price_event_type" NOT NULL,
	"old_price" integer,
	"new_price" integer,
	"sale_id" integer,
	"note" text,
	"occurred_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "price_points" (
	"id" serial PRIMARY KEY NOT NULL,
	"listing_id" integer NOT NULL,
	"base_price" integer NOT NULL,
	"sale_price" integer,
	"member_price" integer,
	"observed_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" serial PRIMARY KEY NOT NULL,
	"game_id" integer NOT NULL,
	"platform" "platform" NOT NULL,
	"edition" text DEFAULT 'standard' NOT NULL,
	"format" "product_format" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "regions" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"currency" text NOT NULL,
	"locale" text NOT NULL,
	CONSTRAINT "regions_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" serial PRIMARY KEY NOT NULL,
	"store_id" integer NOT NULL,
	"region_id" integer NOT NULL,
	"name" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "stores" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"kind" "store_kind" NOT NULL,
	CONSTRAINT "stores_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "listings" ADD CONSTRAINT "listings_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_events" ADD CONSTRAINT "price_events_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_events" ADD CONSTRAINT "price_events_sale_id_sales_id_fk" FOREIGN KEY ("sale_id") REFERENCES "public"."sales"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "price_points" ADD CONSTRAINT "price_points_listing_id_listings_id_fk" FOREIGN KEY ("listing_id") REFERENCES "public"."listings"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_store_id_stores_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."stores"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_region_id_regions_id_fk" FOREIGN KEY ("region_id") REFERENCES "public"."regions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "listings_store_item" ON "listings" USING btree ("store_id","region_id","store_product_id");--> statement-breakpoint
CREATE INDEX "listings_product" ON "listings" USING btree ("product_id");--> statement-breakpoint
CREATE INDEX "price_events_listing_time" ON "price_events" USING btree ("listing_id","occurred_at");--> statement-breakpoint
CREATE INDEX "price_points_listing_time" ON "price_points" USING btree ("listing_id","observed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "products_unique" ON "products" USING btree ("game_id","platform","edition","format");--> statement-breakpoint
CREATE UNIQUE INDEX "sales_unique" ON "sales" USING btree ("store_id","region_id","name","starts_at");