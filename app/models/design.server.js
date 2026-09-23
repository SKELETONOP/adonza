import db from "../db.server";
import { DEFAULT_DESIGN } from "./design";

export async function getDesignSettings(shop) {
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

export async function saveDesignSettings(shop, settings) {
  await db.shopSettings.upsert({
    where: { shop },
    create: { shop, ...settings },
    update: { ...settings },
  });
}
