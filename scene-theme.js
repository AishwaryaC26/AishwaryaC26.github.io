const LIGHT_BLOOM_TINT = 0xffffff;
const DEFAULT_BLOOM_REF = 0xff9ec8;
const DARK_STEM = 0x2d5a42;

function hexToRgb(hex) {
  return {
    r: (hex >> 16) & 255,
    g: (hex >> 8) & 255,
    b: hex & 255,
  };
}

function rgbToHex(r, g, b) {
  return (
    ((Math.round(r) & 255) << 16) |
    ((Math.round(g) & 255) << 8) |
    (Math.round(b) & 255)
  );
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0;
  let s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
        break;
      case g:
        h = ((b - r) / d + 2) / 6;
        break;
      default:
        h = ((r - g) / d + 4) / 6;
        break;
    }
  }

  return { h, s, l };
}

function hslToRgb(h, s, l) {
  if (s === 0) {
    const v = l * 255;
    return { r: v, g: v, b: v };
  }

  const hue2rgb = (p, q, t) => {
    let x = t;
    if (x < 0) x += 1;
    if (x > 1) x -= 1;
    if (x < 1 / 6) return p + (q - p) * 6 * x;
    if (x < 1 / 2) return q;
    if (x < 2 / 3) return p + (q - p) * (2 / 3 - x) * 6;
    return p;
  };

  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return {
    r: hue2rgb(p, q, h + 1 / 3) * 255,
    g: hue2rgb(p, q, h) * 255,
    b: hue2rgb(p, q, h - 1 / 3) * 255,
  };
}

function relativeLuminance(hex) {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c) => {
    const x = c / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** Dark vivid bloom: same hue as light mode; lighter flowers stay lighter, darker stay darker. */
export function darkBloomFromLight(hex) {
  const { r, g, b } = hexToRgb(hex);
  let { h, s, l } = rgbToHsl(r, g, b);

  const lum = relativeLuminance(hex);
  const t = Math.pow(lum, 0.55);
  const darkL = 0.34 + t * 0.38;

  s = Math.min(0.98, Math.max(0.52, s * 1.12 + 0.1));

  const out = hslToRgb(h, s, darkL);
  return rgbToHex(out.r, out.g, out.b);
}

export function applyFlowerTheme(group, isDark) {
  const theme = group.userData.theme;
  if (!theme) return;

  const { bloomMat, stemGreenMat, calyxMat, bloomColorHex, stemColorHex } =
    theme;

  if (isDark) {
    const source = bloomColorHex ?? theme.referenceBloomHex ?? DEFAULT_BLOOM_REF;
    bloomMat.color.setHex(darkBloomFromLight(source));
    stemGreenMat.color.setHex(DARK_STEM);
    calyxMat.color.setHex(DARK_STEM);
  } else {
    bloomMat.color.setHex(
      bloomColorHex != null ? bloomColorHex : LIGHT_BLOOM_TINT,
    );
    stemGreenMat.color.setHex(stemColorHex);
    calyxMat.color.setHex(stemColorHex);
  }
}

export function applyBeeTheme(beeGroup, isDark) {
  const theme = beeGroup?.userData.theme;
  if (!theme) return;

  if (isDark) {
    theme.bodyMat.color.setHex(0xf5c842);
    theme.wingMat.color.setHex(0xc8d4e8);
    theme.wingMat.opacity = 0.85;
  } else {
    theme.bodyMat.color.setHex(theme.bodyColorHex);
    theme.wingMat.color.setHex(theme.wingColorHex);
    theme.wingMat.opacity = 0.92;
  }
}
