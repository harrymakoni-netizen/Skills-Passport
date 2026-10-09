-- CreateTable
CREATE TABLE "kv_entries" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3),

    CONSTRAINT "kv_entries_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "queued_tasks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "data" JSONB NOT NULL,
    "due_at" TIMESTAMP(3) NOT NULL,
    "job_id" TEXT,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "locked_until" TIMESTAMP(3),
    "last_error" TEXT,
    "failed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "queued_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stored_objects" (
    "bucket" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "data" BYTEA NOT NULL,
    "content_type" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_objects_pkey" PRIMARY KEY ("bucket","key")
);

-- CreateTable
CREATE TABLE "mock_chat_entries" (
    "id" SERIAL NOT NULL,
    "phone" TEXT NOT NULL,
    "entry" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "mock_chat_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "kv_entries_expires_at_idx" ON "kv_entries"("expires_at");

-- CreateIndex
CREATE UNIQUE INDEX "queued_tasks_job_id_key" ON "queued_tasks"("job_id");

-- CreateIndex
CREATE INDEX "queued_tasks_due_at_idx" ON "queued_tasks"("due_at");

-- CreateIndex
CREATE INDEX "mock_chat_entries_phone_id_idx" ON "mock_chat_entries"("phone", "id");

