// Maps each ReadFlow theme to a Radix Colors scale + light/dark variant,
// then resolves tooltip colors (subtle tinted bg + high-contrast text + border).
import {
  amber, amberDark,
  blue, blueDark,
  bronze, bronzeDark,
  grass, grassDark,
  jade, jadeDark,
  orange, orangeDark,
  teal, tealDark,
  tomato, tomatoDark,
  violet, violetDark,
} from "@radix-ui/colors";

const SCALES = {
  amber:  { light: amber,  dark: amberDark,  key: "amber"  },
  blue:   { light: blue,   dark: blueDark,   key: "blue"   },
  bronze: { light: bronze, dark: bronzeDark, key: "bronze" },
  grass:  { light: grass,  dark: grassDark,  key: "grass"  },
  jade:   { light: jade,   dark: jadeDark,   key: "jade"   },
  orange: { light: orange, dark: orangeDark, key: "orange" },
  teal:   { light: teal,   dark: tealDark,   key: "teal"   },
  tomato: { light: tomato, dark: tomatoDark, key: "tomato" },
  violet: { light: violet, dark: violetDark, key: "violet" },
};

const THEME_TO_SCALE = {
  warm:     { scale: "orange", dark: false },
  cool:     { scale: "blue",   dark: false },
  sepia:    { scale: "bronze", dark: false },
  forest:   { scale: "teal",   dark: false },
  crimson:  { scale: "tomato", dark: false },
  phosphor: { scale: "grass",  dark: true  },
  jungle:   { scale: "jade",   dark: true  },
  dark:     { scale: "amber",  dark: true  },
  midnight: { scale: "blue",   dark: true  },
  obsidian: { scale: "violet", dark: true  },
};

// Tooltip uses step 4 (subtle hover bg) for tint, step 12 for text, step 7 for border.
export function getTooltipColors(themeKey) {
  const map = THEME_TO_SCALE[themeKey] ?? THEME_TO_SCALE.warm;
  const cfg = SCALES[map.scale];
  const palette = map.dark ? cfg.dark : cfg.light;
  return {
    bg:     palette[`${cfg.key}4`],
    fg:     palette[`${cfg.key}12`],
    border: palette[`${cfg.key}7`],
  };
}
