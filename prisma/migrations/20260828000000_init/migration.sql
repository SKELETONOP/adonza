-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "scope" TEXT,
    "expires" TIMESTAMP(3),
    "accessToken" TEXT NOT NULL,
    "userId" BIGINT,
    "firstName" TEXT,
    "lastName" TEXT,
    "email" TEXT,
    "accountOwner" BOOLEAN NOT NULL DEFAULT false,
    "locale" TEXT,
    "collaborator" BOOLEAN DEFAULT false,
    "emailVerified" BOOLEAN DEFAULT false,
    "refreshToken" TEXT,
    "refreshTokenExpires" TIMESTAMP(3),

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "triggerMode" TEXT NOT NULL DEFAULT 'specific',
    "triggerBasis" TEXT NOT NULL DEFAULT 'quantity',
    "triggerQuantity" INTEGER NOT NULL DEFAULT 1,
    "triggerAmount" INTEGER,
    "freeQuantity" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Rule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleTriggerItem" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "RuleTriggerItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RuleFreeOption" (
    "id" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productTitle" TEXT NOT NULL,
    "variantId" TEXT NOT NULL,
    "variantTitle" TEXT NOT NULL,
    "imageUrl" TEXT,

    CONSTRAINT "RuleFreeOption_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShopSettings" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "popupHeading" TEXT NOT NULL DEFAULT 'You''ve unlocked a free gift!',
    "popupSubheading" TEXT NOT NULL DEFAULT 'Choose which one you''d like:',
    "imageShape" TEXT NOT NULL DEFAULT 'rounded',
    "titleColor" TEXT NOT NULL DEFAULT '#1a1a1a',
    "buttonColor" TEXT NOT NULL DEFAULT '#008060',
    "buttonTextColor" TEXT NOT NULL DEFAULT '#ffffff',
    "automaticDiscountId" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShopSettings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Feedback" (
    "id" TEXT NOT NULL,
    "shop" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Feedback_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Rule_shop_idx" ON "Rule"("shop");

-- CreateIndex
CREATE INDEX "Rule_shop_active_idx" ON "Rule"("shop", "active");

-- CreateIndex
CREATE INDEX "RuleTriggerItem_ruleId_idx" ON "RuleTriggerItem"("ruleId");

-- CreateIndex
CREATE INDEX "RuleFreeOption_ruleId_idx" ON "RuleFreeOption"("ruleId");

-- CreateIndex
CREATE UNIQUE INDEX "ShopSettings_shop_key" ON "ShopSettings"("shop");

-- CreateIndex
CREATE INDEX "Feedback_shop_idx" ON "Feedback"("shop");

-- AddForeignKey
ALTER TABLE "RuleTriggerItem" ADD CONSTRAINT "RuleTriggerItem_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RuleFreeOption" ADD CONSTRAINT "RuleFreeOption_ruleId_fkey" FOREIGN KEY ("ruleId") REFERENCES "Rule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

