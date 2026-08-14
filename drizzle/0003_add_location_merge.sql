ALTER TABLE "locations" ADD COLUMN "merged_into" uuid;--> statement-breakpoint
CREATE INDEX "locations_merged_into_idx" ON "locations" USING btree ("merged_into");