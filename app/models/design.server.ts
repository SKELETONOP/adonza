import db from "../db.server";
import { DEFAULT_DESIGN, type DesignSettings } from "./design";

export async function getDesignSettings(shop: string): Promise<DesignSettings> {
  const row = await db.shopSettings.findUnique({ where: { shop } });
  if (!row) return DEFAULT_DESIGN;

  return {
    popupHeading: row.popupHeading,
    popupSubheading: row.popupSubheading,
    imageShape: row.imageShape === "square" ? "square" : "rounded",
    titleColor: row.titleColor,
    buttonColor: row.buttonColor,
    buttonTextColor: row.buttonTextColor,
  };
}

export async function saveDesignSettings(
  shop: string,
  settings: DesignSettings,
) {
  await db.shopSettings.upsert({
    where: { shop },
    create: { shop, ...settings },
    update: { ...settings },
  });
}
