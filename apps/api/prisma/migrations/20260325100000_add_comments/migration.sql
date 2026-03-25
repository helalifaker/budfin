CREATE TABLE "comments" (
  "id" SERIAL NOT NULL,
  "version_id" INTEGER NOT NULL,
  "target_type" VARCHAR(30) NOT NULL,
  "target_id" VARCHAR(100) NOT NULL,
  "parent_id" INTEGER,
  "author_id" INTEGER NOT NULL,
  "body" TEXT NOT NULL,
  "resolved_at" TIMESTAMPTZ,
  "resolved_by_id" INTEGER,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "comments_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "idx_comment_target" ON "comments"("version_id", "target_type", "target_id");
CREATE INDEX "idx_comment_parent" ON "comments"("parent_id");
ALTER TABLE "comments"
  ADD CONSTRAINT "comments_version_id_fkey"
  FOREIGN KEY ("version_id") REFERENCES "budget_versions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments"
  ADD CONSTRAINT "comments_parent_id_fkey"
  FOREIGN KEY ("parent_id") REFERENCES "comments"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "comments"
  ADD CONSTRAINT "comments_author_id_fkey"
  FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "comments"
  ADD CONSTRAINT "comments_resolved_by_id_fkey"
  FOREIGN KEY ("resolved_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
