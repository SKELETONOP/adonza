export type ImageShape = "rounded" | "square";

export type DesignSettings = {
  popupHeading: string;
  popupSubheading: string;
  imageShape: ImageShape;
  titleColor: string;
  buttonColor: string;
  buttonTextColor: string;
};

export const DEFAULT_DESIGN: DesignSettings = {
  popupHeading: "You've unlocked a free gift!",
  popupSubheading: "Choose which one you'd like:",
  imageShape: "rounded",
  titleColor: "#1a1a1a",
  buttonColor: "#008060",
  buttonTextColor: "#ffffff",
};
