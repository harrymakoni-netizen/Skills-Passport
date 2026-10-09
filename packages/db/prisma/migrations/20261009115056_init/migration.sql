-- CreateEnum
CREATE TYPE "Language" AS ENUM ('en', 'sn', 'nd');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('starter', 'bronze', 'silver', 'gold');

-- CreateEnum
CREATE TYPE "ArtisanStatus" AS ENUM ('onboarding', 'active', 'frozen', 'deleted');

-- CreateEnum
CREATE TYPE "HowLearned" AS ENUM ('apprenticeship', 'family', 'self_taught', 'college', 'other');

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('admin', 'verifier', 'agent', 'buyer');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('draft', 'submitted', 'awaiting_client', 'client_confirmed', 'client_disputed', 'client_expired', 'under_review', 'verified', 'needs_improvement', 'rejected', 'closed');

-- CreateEnum
CREATE TYPE "MediaKind" AS ENUM ('photo_before', 'photo_after', 'video', 'voice');

-- CreateEnum
CREATE TYPE "ConfirmationChannel" AS ENUM ('whatsapp', 'agent');

-- CreateEnum
CREATE TYPE "ConfirmationResponse" AS ENUM ('confirmed', 'disputed', 'expired');

-- CreateEnum
CREATE TYPE "CompetencySource" AS ENUM ('ai', 'verifier');

-- CreateEnum
CREATE TYPE "JobCompetencyStatus" AS ENUM ('suggested', 'confirmed', 'removed');

-- CreateEnum
CREATE TYPE "ReviewQuality" AS ENUM ('meets', 'needs_improvement', 'reject');

-- CreateEnum
CREATE TYPE "VerifierStatus" AS ENUM ('pending', 'active', 'suspended');

-- CreateEnum
CREATE TYPE "BuyerType" AS ENUM ('business', 'ngo', 'household', 'government');

-- CreateEnum
CREATE TYPE "WorkRequestStatus" AS ENUM ('sent', 'accepted', 'declined', 'expired');

-- CreateEnum
CREATE TYPE "WorkRequestOutcome" AS ENUM ('hired', 'not_hired', 'unknown');

-- CreateEnum
CREATE TYPE "ReportStatus" AS ENUM ('open', 'upheld', 'dismissed');

-- CreateEnum
CREATE TYPE "FlagEntity" AS ENUM ('job', 'client', 'verifier', 'artisan');

-- CreateEnum
CREATE TYPE "FlagSeverity" AS ENUM ('soft', 'standard', 'high');

-- CreateEnum
CREATE TYPE "FlagStatus" AS ENUM ('open', 'upheld', 'cleared');

-- CreateEnum
CREATE TYPE "ConsentKind" AS ENUM ('core', 'sensitive_demographics', 'public_badge', 'lender');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('queued', 'sent', 'delivered', 'read', 'failed', 'undeliverable');

-- CreateTable
CREATE TABLE "areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "city_code" TEXT NOT NULL,
    "province" TEXT NOT NULL,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "passport_sequences" (
    "city_code" TEXT NOT NULL,
    "next" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "passport_sequences_pkey" PRIMARY KEY ("city_code")
);

-- CreateTable
CREATE TABLE "trades" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name_en" TEXT NOT NULL,
    "name_sn" TEXT NOT NULL,
    "name_nd" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "trades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_units" (
    "id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" JSONB NOT NULL,
    "description" TEXT NOT NULL,
    "evidence_guidance" TEXT NOT NULL,
    "class_level" TEXT,
    "standard_ref" TEXT,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "competency_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_types" (
    "id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" JSONB NOT NULL,
    "needs_before_photo" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "job_types_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_type_units" (
    "job_type_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,

    CONSTRAINT "job_type_units_pkey" PRIMARY KEY ("job_type_id","unit_id")
);

-- CreateTable
CREATE TABLE "artisans" (
    "id" TEXT NOT NULL,
    "passport_code" TEXT NOT NULL,
    "display_name" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "show_full_name" BOOLEAN NOT NULL DEFAULT false,
    "area_id" TEXT NOT NULL,
    "area_pending" BOOLEAN NOT NULL DEFAULT false,
    "level" "Level" NOT NULL DEFAULT 'starter',
    "level_frozen" BOOLEAN NOT NULL DEFAULT false,
    "trust_score" INTEGER NOT NULL DEFAULT 88,
    "status" "ArtisanStatus" NOT NULL DEFAULT 'active',
    "language" "Language" NOT NULL DEFAULT 'en',
    "birth_year" INTEGER,
    "experience_years" INTEGER,
    "how_learned" "HowLearned",
    "gender" TEXT,
    "disability" TEXT,
    "public_badges" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "profile_photo_key" TEXT,
    "enrolled_by_agent_id" TEXT,
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),
    "purge_after" TIMESTAMP(3),
    "pseudonym" TEXT NOT NULL,

    CONSTRAINT "artisans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "artisan_trades" (
    "artisan_id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "primary" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "artisan_trades_pkey" PRIMARY KEY ("artisan_id","trade_id")
);

-- CreateTable
CREATE TABLE "artisan_pii" (
    "artisan_id" TEXT NOT NULL,
    "full_name_enc" BYTEA NOT NULL,
    "phone_enc" BYTEA NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "trusted_contact_enc" BYTEA,

    CONSTRAINT "artisan_pii_pkey" PRIMARY KEY ("artisan_id")
);

-- CreateTable
CREATE TABLE "consents" (
    "id" TEXT NOT NULL,
    "artisan_id" TEXT NOT NULL,
    "kind" "ConsentKind" NOT NULL,
    "text_version" TEXT NOT NULL,
    "language" "Language" NOT NULL,
    "channel" TEXT NOT NULL,
    "granted_at" TIMESTAMP(3) NOT NULL,
    "revoked_at" TIMESTAMP(3),
    "details" JSONB,

    CONSTRAINT "consents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "name" TEXT NOT NULL,
    "email_hash" TEXT,
    "email_enc" BYTEA,
    "phone_hash" TEXT,
    "phone_enc" BYTEA,
    "password_hash" TEXT NOT NULL,
    "totp_secret_enc" BYTEA,
    "totp_enabled_at" TIMESTAMP(3),
    "active" BOOLEAN NOT NULL DEFAULT true,
    "last_login_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "field_agents" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area_id" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "field_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_tasks" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "artisan_id" TEXT,
    "job_id" TEXT,
    "note" TEXT,
    "assigned_to" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),

    CONSTRAINT "agent_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifiers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "area_id" TEXT,
    "years_experience" INTEGER NOT NULL,
    "status" "VerifierStatus" NOT NULL DEFAULT 'pending',
    "approved_by_id" TEXT,
    "bio" TEXT,

    CONSTRAINT "verifiers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verifier_trades" (
    "verifier_id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,

    CONSTRAINT "verifier_trades_pkey" PRIMARY KEY ("verifier_id","trade_id")
);

-- CreateTable
CREATE TABLE "verifier_conflicts" (
    "verifier_id" TEXT NOT NULL,
    "artisan_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "declared_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "verifier_conflicts_pkey" PRIMARY KEY ("verifier_id","artisan_id")
);

-- CreateTable
CREATE TABLE "clients" (
    "id" TEXT NOT NULL,
    "phone_hash" TEXT NOT NULL,
    "phone_enc" BYTEA NOT NULL,
    "name_enc" BYTEA,
    "first_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "first_artisan_id" TEXT,
    "language" "Language" NOT NULL DEFAULT 'en',
    "opted_out" BOOLEAN NOT NULL DEFAULT false,
    "opted_out_at" TIMESTAMP(3),
    "reports_count" INTEGER NOT NULL DEFAULT 0,
    "blocked" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jobs" (
    "id" TEXT NOT NULL,
    "ref" TEXT NOT NULL,
    "artisan_id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "job_type_id" TEXT NOT NULL,
    "job_date" DATE,
    "area_id" TEXT,
    "lat" DOUBLE PRECISION,
    "lng" DOUBLE PRECISION,
    "amount_charged_cents" INTEGER,
    "client_id" TEXT,
    "client_name_enc" BYTEA,
    "status" "JobStatus" NOT NULL DEFAULT 'draft',
    "disputed" BOOLEAN NOT NULL DEFAULT false,
    "dispute_resolved_for_artisan" BOOLEAN NOT NULL DEFAULT false,
    "agent_assisted" BOOLEAN NOT NULL DEFAULT false,
    "agent_id" TEXT,
    "artisan_confirmed_at" TIMESTAMP(3),
    "notes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "ai_summary" JSONB,
    "artisan_summary" JSONB,
    "ai_status" TEXT NOT NULL DEFAULT 'pending',
    "summary_confirmed_at" TIMESTAMP(3),
    "public" BOOLEAN NOT NULL DEFAULT true,
    "flag_rules" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "counted" BOOLEAN NOT NULL DEFAULT false,
    "review_required" BOOLEAN NOT NULL DEFAULT false,
    "review_reason" TEXT,
    "assigned_verifier_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMP(3),
    "status_changed_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "queued_for_review_at" TIMESTAMP(3),

    CONSTRAINT "jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_media" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "provider_media_id" TEXT,
    "original_key" TEXT,
    "public_key" TEXT,
    "thumb_key" TEXT,
    "mime_type" TEXT NOT NULL,
    "bytes" INTEGER,
    "width" INTEGER,
    "height" INTEGER,
    "duration_sec" INTEGER,
    "phash" TEXT,
    "captured_at" TIMESTAMP(3),
    "exif_lat" DOUBLE PRECISION,
    "exif_lng" DOUBLE PRECISION,
    "quality_score" DOUBLE PRECISION,
    "quality_problem" TEXT,
    "image_checks" JSONB,
    "duplicate_of_id" TEXT,
    "public" BOOLEAN NOT NULL DEFAULT true,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "job_media_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transcripts" (
    "id" TEXT NOT NULL,
    "job_media_id" TEXT NOT NULL,
    "language" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "confidence" DOUBLE PRECISION NOT NULL,
    "model_version" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transcripts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "confirmations" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "channel" "ConfirmationChannel" NOT NULL,
    "token_hash" TEXT NOT NULL,
    "token_expires_at" TIMESTAMP(3) NOT NULL,
    "token_used_at" TIMESTAMP(3),
    "sent_at" TIMESTAMP(3),
    "delivery_status" "DeliveryStatus" NOT NULL DEFAULT 'queued',
    "reminders_sent" INTEGER NOT NULL DEFAULT 0,
    "response" "ConfirmationResponse",
    "rating" INTEGER,
    "comment" TEXT,
    "responded_at" TIMESTAMP(3),
    "recorded_by_agent_id" TEXT,
    "dev_token" TEXT,

    CONSTRAINT "confirmations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_competencies" (
    "job_id" TEXT NOT NULL,
    "unit_id" TEXT NOT NULL,
    "source" "CompetencySource" NOT NULL,
    "confidence" DOUBLE PRECISION,
    "evidence" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "status" "JobCompetencyStatus" NOT NULL DEFAULT 'suggested',
    "reviewer_id" TEXT,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_competencies_pkey" PRIMARY KEY ("job_id","unit_id","source")
);

-- CreateTable
CREATE TABLE "reviews" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "verifier_id" TEXT NOT NULL,
    "quality" "ReviewQuality" NOT NULL,
    "note_to_artisan" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "demonstration_requests" (
    "id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "verifier_id" TEXT NOT NULL,
    "note" TEXT,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "demonstration_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "endorsements" (
    "id" TEXT NOT NULL,
    "artisan_id" TEXT NOT NULL,
    "verifier_id" TEXT NOT NULL,
    "trade_id" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "withdrawn_at" TIMESTAMP(3),
    "withdrawn_reason" TEXT,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "buyers" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "org_name" TEXT NOT NULL,
    "type" "BuyerType" NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "contact_name_enc" BYTEA NOT NULL,
    "contact_phone_enc" BYTEA NOT NULL,
    "contact_phone_hash" TEXT NOT NULL,
    "plan" TEXT,

    CONSTRAINT "buyers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "work_requests" (
    "id" TEXT NOT NULL,
    "buyer_id" TEXT NOT NULL,
    "artisan_id" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "preferred_dates" TEXT NOT NULL,
    "status" "WorkRequestStatus" NOT NULL DEFAULT 'sent',
    "outcome" "WorkRequestOutcome" NOT NULL DEFAULT 'unknown',
    "buyer_outcome" "WorkRequestOutcome" NOT NULL DEFAULT 'unknown',
    "job_id" TEXT,
    "responded_at" TIMESTAMP(3),
    "follow_up_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "work_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "client_reports" (
    "id" TEXT NOT NULL,
    "artisan_id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "details" TEXT,
    "status" "ReportStatus" NOT NULL DEFAULT 'open',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "client_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "level_history" (
    "id" TEXT NOT NULL,
    "artisan_id" TEXT NOT NULL,
    "from_level" "Level" NOT NULL,
    "to_level" "Level" NOT NULL,
    "reason" JSONB NOT NULL,
    "config_version" INTEGER NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "level_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fraud_flags" (
    "id" TEXT NOT NULL,
    "entity" "FlagEntity" NOT NULL,
    "entity_id" TEXT NOT NULL,
    "rule" TEXT NOT NULL,
    "severity" "FlagSeverity" NOT NULL,
    "reason" TEXT NOT NULL,
    "evidence" JSONB,
    "status" "FlagStatus" NOT NULL DEFAULT 'open',
    "resolved_by_id" TEXT,
    "resolved_at" TIMESTAMP(3),
    "resolution_note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fraud_flags_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "configs" (
    "version" INTEGER NOT NULL,
    "params" JSONB NOT NULL,
    "active_from" TIMESTAMP(3) NOT NULL,
    "created_by_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configs_pkey" PRIMARY KEY ("version")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "actor_id" TEXT,
    "action" TEXT NOT NULL,
    "entity" TEXT NOT NULL,
    "entity_id" TEXT,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "details" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "inbound_messages" (
    "provider_message_id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "from_hash" TEXT NOT NULL,
    "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processed_at" TIMESTAMP(3),

    CONSTRAINT "inbound_messages_pkey" PRIMARY KEY ("provider_message_id")
);

-- CreateTable
CREATE TABLE "outbound_messages" (
    "id" TEXT NOT NULL,
    "provider_message_id" TEXT,
    "to_hash" TEXT NOT NULL,
    "template_name" TEXT,
    "purpose" TEXT NOT NULL,
    "related_entity" TEXT,
    "related_id" TEXT,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'queued',
    "error" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "outbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "media_upload_requests" (
    "id" TEXT NOT NULL,
    "agent_id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "mime_type" TEXT NOT NULL,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),

    CONSTRAINT "media_upload_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_events" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "subject_id" TEXT NOT NULL,
    "props" JSONB,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "areas_city_code_idx" ON "areas"("city_code");

-- CreateIndex
CREATE UNIQUE INDEX "areas_city_name_key" ON "areas"("city", "name");

-- CreateIndex
CREATE UNIQUE INDEX "trades_code_key" ON "trades"("code");

-- CreateIndex
CREATE UNIQUE INDEX "competency_units_code_key" ON "competency_units"("code");

-- CreateIndex
CREATE INDEX "competency_units_trade_id_idx" ON "competency_units"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "job_types_key_key" ON "job_types"("key");

-- CreateIndex
CREATE INDEX "job_types_trade_id_idx" ON "job_types"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "artisans_passport_code_key" ON "artisans"("passport_code");

-- CreateIndex
CREATE UNIQUE INDEX "artisans_pseudonym_key" ON "artisans"("pseudonym");

-- CreateIndex
CREATE INDEX "artisans_area_id_level_idx" ON "artisans"("area_id", "level");

-- CreateIndex
CREATE INDEX "artisans_status_level_idx" ON "artisans"("status", "level");

-- CreateIndex
CREATE INDEX "artisan_trades_trade_id_idx" ON "artisan_trades"("trade_id");

-- CreateIndex
CREATE UNIQUE INDEX "artisan_pii_phone_hash_key" ON "artisan_pii"("phone_hash");

-- CreateIndex
CREATE INDEX "consents_artisan_id_kind_idx" ON "consents"("artisan_id", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_hash_key" ON "users"("email_hash");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_hash_key" ON "users"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "field_agents_user_id_key" ON "field_agents"("user_id");

-- CreateIndex
CREATE INDEX "agent_tasks_status_created_at_idx" ON "agent_tasks"("status", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "verifiers_user_id_key" ON "verifiers"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "clients_phone_hash_key" ON "clients"("phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "jobs_ref_key" ON "jobs"("ref");

-- CreateIndex
CREATE INDEX "jobs_artisan_id_status_idx" ON "jobs"("artisan_id", "status");

-- CreateIndex
CREATE INDEX "jobs_trade_id_status_review_required_created_at_idx" ON "jobs"("trade_id", "status", "review_required", "created_at");

-- CreateIndex
CREATE INDEX "jobs_client_id_created_at_idx" ON "jobs"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "jobs_status_status_changed_at_idx" ON "jobs"("status", "status_changed_at");

-- CreateIndex
CREATE INDEX "job_media_job_id_idx" ON "job_media"("job_id");

-- CreateIndex
CREATE INDEX "job_media_phash_idx" ON "job_media"("phash");

-- CreateIndex
CREATE UNIQUE INDEX "transcripts_job_media_id_key" ON "transcripts"("job_media_id");

-- CreateIndex
CREATE UNIQUE INDEX "confirmations_job_id_key" ON "confirmations"("job_id");

-- CreateIndex
CREATE UNIQUE INDEX "confirmations_token_hash_key" ON "confirmations"("token_hash");

-- CreateIndex
CREATE INDEX "confirmations_client_id_responded_at_idx" ON "confirmations"("client_id", "responded_at");

-- CreateIndex
CREATE INDEX "job_competencies_unit_id_idx" ON "job_competencies"("unit_id");

-- CreateIndex
CREATE UNIQUE INDEX "reviews_job_id_key" ON "reviews"("job_id");

-- CreateIndex
CREATE INDEX "reviews_verifier_id_created_at_idx" ON "reviews"("verifier_id", "created_at");

-- CreateIndex
CREATE INDEX "endorsements_artisan_id_idx" ON "endorsements"("artisan_id");

-- CreateIndex
CREATE UNIQUE INDEX "buyers_user_id_key" ON "buyers"("user_id");

-- CreateIndex
CREATE INDEX "buyers_contact_phone_hash_idx" ON "buyers"("contact_phone_hash");

-- CreateIndex
CREATE UNIQUE INDEX "work_requests_job_id_key" ON "work_requests"("job_id");

-- CreateIndex
CREATE INDEX "work_requests_artisan_id_status_idx" ON "work_requests"("artisan_id", "status");

-- CreateIndex
CREATE INDEX "work_requests_buyer_id_created_at_idx" ON "work_requests"("buyer_id", "created_at");

-- CreateIndex
CREATE INDEX "client_reports_client_id_idx" ON "client_reports"("client_id");

-- CreateIndex
CREATE INDEX "level_history_artisan_id_at_idx" ON "level_history"("artisan_id", "at");

-- CreateIndex
CREATE INDEX "fraud_flags_status_severity_created_at_idx" ON "fraud_flags"("status", "severity", "created_at");

-- CreateIndex
CREATE INDEX "fraud_flags_entity_entity_id_idx" ON "fraud_flags"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_entity_entity_id_idx" ON "audit_log"("entity", "entity_id");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- CreateIndex
CREATE UNIQUE INDEX "outbound_messages_provider_message_id_key" ON "outbound_messages"("provider_message_id");

-- CreateIndex
CREATE INDEX "outbound_messages_related_entity_related_id_idx" ON "outbound_messages"("related_entity", "related_id");

-- CreateIndex
CREATE UNIQUE INDEX "media_upload_requests_key_key" ON "media_upload_requests"("key");

-- CreateIndex
CREATE INDEX "product_events_name_at_idx" ON "product_events"("name", "at");

-- AddForeignKey
ALTER TABLE "competency_units" ADD CONSTRAINT "competency_units_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_types" ADD CONSTRAINT "job_types_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_type_units" ADD CONSTRAINT "job_type_units_job_type_id_fkey" FOREIGN KEY ("job_type_id") REFERENCES "job_types"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_type_units" ADD CONSTRAINT "job_type_units_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "competency_units"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisans" ADD CONSTRAINT "artisans_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisans" ADD CONSTRAINT "artisans_enrolled_by_agent_id_fkey" FOREIGN KEY ("enrolled_by_agent_id") REFERENCES "field_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_trades" ADD CONSTRAINT "artisan_trades_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_trades" ADD CONSTRAINT "artisan_trades_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "artisan_pii" ADD CONSTRAINT "artisan_pii_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "consents" ADD CONSTRAINT "consents_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_agents" ADD CONSTRAINT "field_agents_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "field_agents" ADD CONSTRAINT "field_agents_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_tasks" ADD CONSTRAINT "agent_tasks_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "field_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifiers" ADD CONSTRAINT "verifiers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifiers" ADD CONSTRAINT "verifiers_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifier_trades" ADD CONSTRAINT "verifier_trades_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "verifiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifier_trades" ADD CONSTRAINT "verifier_trades_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifier_conflicts" ADD CONSTRAINT "verifier_conflicts_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "verifiers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "verifier_conflicts" ADD CONSTRAINT "verifier_conflicts_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_job_type_id_fkey" FOREIGN KEY ("job_type_id") REFERENCES "job_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_agent_id_fkey" FOREIGN KEY ("agent_id") REFERENCES "field_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_media" ADD CONSTRAINT "job_media_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transcripts" ADD CONSTRAINT "transcripts_job_media_id_fkey" FOREIGN KEY ("job_media_id") REFERENCES "job_media"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "confirmations" ADD CONSTRAINT "confirmations_recorded_by_agent_id_fkey" FOREIGN KEY ("recorded_by_agent_id") REFERENCES "field_agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_competencies" ADD CONSTRAINT "job_competencies_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_competencies" ADD CONSTRAINT "job_competencies_unit_id_fkey" FOREIGN KEY ("unit_id") REFERENCES "competency_units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviews" ADD CONSTRAINT "reviews_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "verifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demonstration_requests" ADD CONSTRAINT "demonstration_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "demonstration_requests" ADD CONSTRAINT "demonstration_requests_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "verifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_verifier_id_fkey" FOREIGN KEY ("verifier_id") REFERENCES "verifiers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "endorsements" ADD CONSTRAINT "endorsements_trade_id_fkey" FOREIGN KEY ("trade_id") REFERENCES "trades"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "buyers" ADD CONSTRAINT "buyers_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_buyer_id_fkey" FOREIGN KEY ("buyer_id") REFERENCES "buyers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_requests" ADD CONSTRAINT "work_requests_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "client_reports" ADD CONSTRAINT "client_reports_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "clients"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "level_history" ADD CONSTRAINT "level_history_artisan_id_fkey" FOREIGN KEY ("artisan_id") REFERENCES "artisans"("id") ON DELETE CASCADE ON UPDATE CASCADE;
