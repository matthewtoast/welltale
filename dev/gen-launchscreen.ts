import fs from "fs/promises";
import path, { join } from "path";
import { colors } from "../web/lib/colors";

const root = join(__dirname, "..");
const outDir = path.join(root, "ios/Welltale/Welltale/Base.lproj");
const outFile = path.join(outDir, "LaunchScreen.storyboard");

const toRGB = (hex: string) => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) / 255;
  const g = parseInt(h.slice(2, 4), 16) / 255;
  const b = parseInt(h.slice(4, 6), 16) / 255;
  return { r, g, b };
};

const xml = (hex: string) => {
  const { r, g, b } = toRGB(hex);
  return `<?xml version="1.0" encoding="UTF-8"?>
<document type="com.apple.InterfaceBuilder3.CocoaTouch.Storyboard.XIB" version="3.0" toolsVersion="21507" targetRuntime="iOS.CocoaTouch" propertyAccessControl="none" useAutolayout="YES" useTraitCollections="YES" launchScreen="YES" initialViewController="VC">
  <device id="retina6_12" orientation="portrait" appearance="light"/>
  <dependencies>
    <plugIn identifier="com.apple.InterfaceBuilder.IBCocoaTouchPlugin" version="21505"/>
    <capability name="documents saved in the Xcode 8 format" minToolsVersion="8.0"/>
  </dependencies>
  <scenes>
    <scene sceneID="scene">
      <objects>
        <viewController id="VC" sceneMemberID="viewController">
          <view key="view" contentMode="scaleToFill" id="VIEW">
            <rect key="frame" x="0" y="0" width="390" height="844"/>
            <color key="backgroundColor" red="${r}" green="${g}" blue="${b}" alpha="1" colorSpace="custom" customColorSpace="sRGB"/>
            <subviews>
              <imageView contentMode="scaleAspectFit" image="BrandingImage" translatesAutoresizingMaskIntoConstraints="NO" id="IMG"/>
            </subviews>
            <constraints>
              <constraint firstItem="IMG" firstAttribute="centerX" secondItem="VIEW" secondAttribute="centerX" id="c1"/>
              <constraint firstItem="IMG" firstAttribute="centerY" secondItem="VIEW" secondAttribute="centerY" id="c2"/>
              <constraint firstItem="IMG" firstAttribute="width"  secondItem="VIEW" secondAttribute="width" multiplier="0.35" id="c3"/>
              <constraint firstItem="IMG" firstAttribute="height" secondItem="IMG"  secondAttribute="width" id="c4"/>
            </constraints>
          </view>
        </viewController>
        <placeholder placeholderIdentifier="IBFirstResponder" id="FR" sceneMemberID="firstResponder"/>
      </objects>
    </scene>
  </scenes>
  <resources>
    <image name="BrandingImage"/>
  </resources>
</document>`;
};

export const main = async () => {
  await fs.mkdir(outDir, { recursive: true });
  await fs.writeFile(outFile, xml(colors.BLACK), "utf8");
  console.log("Wrote LaunchScreen.storyboard");
};

main();
