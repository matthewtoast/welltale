import fs from "fs/promises";
import path, { join } from "path";
import sharp from "sharp";
import { colors } from "../web/lib/colors";

const root = join(__dirname, "..");
const svg = path.join(root, "web/app/assets/logomark.svg");
const appIconDir = path.join(
  root,
  "ios/Welltale/Welltale/Assets.xcassets/AppIcon.appiconset"
);
const brandingDir = path.join(
  root,
  "ios/Welltale/Welltale/Assets.xcassets/BrandingImage.imageset"
);

type Icon = {
  idiom: string;
  sizePt: number;
  scale: number;
  pixels: number;
  filename: string;
};

const icons: Icon[] = [
  {
    idiom: "iphone",
    sizePt: 20,
    scale: 2,
    pixels: 40,
    filename: "icon-iphone-20@2x.png",
  },
  {
    idiom: "iphone",
    sizePt: 20,
    scale: 3,
    pixels: 60,
    filename: "icon-iphone-20@3x.png",
  },
  {
    idiom: "ipad",
    sizePt: 20,
    scale: 1,
    pixels: 20,
    filename: "icon-ipad-20@1x.png",
  },
  {
    idiom: "ipad",
    sizePt: 20,
    scale: 2,
    pixels: 40,
    filename: "icon-ipad-20@2x.png",
  },

  {
    idiom: "iphone",
    sizePt: 29,
    scale: 2,
    pixels: 58,
    filename: "icon-iphone-29@2x.png",
  },
  {
    idiom: "iphone",
    sizePt: 29,
    scale: 3,
    pixels: 87,
    filename: "icon-iphone-29@3x.png",
  },
  {
    idiom: "ipad",
    sizePt: 29,
    scale: 1,
    pixels: 29,
    filename: "icon-ipad-29@1x.png",
  },
  {
    idiom: "ipad",
    sizePt: 29,
    scale: 2,
    pixels: 58,
    filename: "icon-ipad-29@2x.png",
  },

  {
    idiom: "iphone",
    sizePt: 40,
    scale: 2,
    pixels: 80,
    filename: "icon-iphone-40@2x.png",
  },
  {
    idiom: "iphone",
    sizePt: 40,
    scale: 3,
    pixels: 120,
    filename: "icon-iphone-40@3x.png",
  },
  {
    idiom: "ipad",
    sizePt: 40,
    scale: 1,
    pixels: 40,
    filename: "icon-ipad-40@1x.png",
  },
  {
    idiom: "ipad",
    sizePt: 40,
    scale: 2,
    pixels: 80,
    filename: "icon-ipad-40@2x.png",
  },

  {
    idiom: "iphone",
    sizePt: 60,
    scale: 2,
    pixels: 120,
    filename: "icon-iphone-60@2x.png",
  },
  {
    idiom: "iphone",
    sizePt: 60,
    scale: 3,
    pixels: 180,
    filename: "icon-iphone-60@3x.png",
  },

  {
    idiom: "ipad",
    sizePt: 76,
    scale: 1,
    pixels: 76,
    filename: "icon-ipad-76@1x.png",
  },
  {
    idiom: "ipad",
    sizePt: 76,
    scale: 2,
    pixels: 152,
    filename: "icon-ipad-76@2x.png",
  },
  {
    idiom: "ipad",
    sizePt: 83.5,
    scale: 2,
    pixels: 167,
    filename: "icon-ipad-83.5@2x.png",
  },

  {
    idiom: "ios-marketing",
    sizePt: 1024,
    scale: 1,
    pixels: 1024,
    filename: "icon-marketing-1024.png",
  },
];

const appIconContents = {
  images: icons.map((i) => ({
    idiom: i.idiom,
    size: `${i.sizePt}x${i.sizePt}`,
    scale: `${i.scale}x`,
    filename: i.filename,
  })),
  info: { version: 1, author: "xcode" },
};

const brandingBasePt = 200;
const branding: { scale: number; px: number; filename: string }[] = [
  { scale: 1, px: brandingBasePt * 1, filename: "brand@1x.png" },
  { scale: 2, px: brandingBasePt * 2, filename: "brand@2x.png" },
  { scale: 3, px: brandingBasePt * 3, filename: "brand@3x.png" },
];

const brandingContents = {
  images: branding.map((b) => ({
    idiom: "universal",
    scale: `${b.scale}x`,
    filename: b.filename,
  })),
  info: { version: 1, author: "xcode" },
};

const ensureDir = async (p: string) => fs.mkdir(p, { recursive: true });

const renderPng = async (outPath: string, px: number) =>
  sharp(svg)
    .flatten({ background: colors.BLACK })
    .resize(px, px, {
      fit: "contain",
      background: colors.BLACK,
    })
    .png()
    .toFile(outPath);

const main = async () => {
  await ensureDir(appIconDir);
  await ensureDir(brandingDir);

  await Promise.all(
    icons.map((i) => renderPng(path.join(appIconDir, i.filename), i.pixels))
  );
  await fs.writeFile(
    path.join(appIconDir, "Contents.json"),
    JSON.stringify(appIconContents, null, 2)
  );

  await Promise.all(
    branding.map((b) => renderPng(path.join(brandingDir, b.filename), b.px))
  );
  await fs.writeFile(
    path.join(brandingDir, "Contents.json"),
    JSON.stringify(brandingContents, null, 2)
  );

  console.log("iOS assets generated.");
};

main();
