export const THEMES = {
  warm:     { bg: "#FDFAF5", reader: "#FFFCF7", fg: "#2C1810", fgSoft: "#6B5744", accent: "#D4853A", accentSoft: "#D4853A22", surface: "#F5EDE0", surfaceHover: "#EDE3D2", border: "#E8DCC8", borderSoft: "#F0E8D8", icon: "#9B8167" },
  cool:     { bg: "#F6F8FB", reader: "#FAFBFD", fg: "#151B28", fgSoft: "#5A6B82", accent: "#3B7DD8", accentSoft: "#3B7DD822", surface: "#EBF0F7", surfaceHover: "#DCE4EF", border: "#D0DAE7", borderSoft: "#E4EAF2", icon: "#7A8FA8" },
  dark:     { bg: "#111116", reader: "#18181E", fg: "#E4E1DB", fgSoft: "#8B8897", accent: "#E8A94E", accentSoft: "#E8A94E22", surface: "#222230", surfaceHover: "#2E2E3E", border: "#2E2E3E", borderSoft: "#252535", icon: "#6E6B7A" },
  sepia:    { bg: "#F1EADB", reader: "#F7F1E4", fg: "#3E2F1E", fgSoft: "#7A6B55", accent: "#8B6914", accentSoft: "#8B691422", surface: "#E8DFCC", surfaceHover: "#DDD2BC", border: "#D4C5A9", borderSoft: "#E0D6C0", icon: "#97886E" },
  midnight: { bg: "#0B0E14", reader: "#0F1219", fg: "#C9D1D9", fgSoft: "#6E7A8A", accent: "#58A6FF", accentSoft: "#58A6FF22", surface: "#161B22", surfaceHover: "#1C2230", border: "#21262D", borderSoft: "#1A1F27", icon: "#4A5568" },
};

export const PALETTES = {
  sunset:   { label: "Sunset",   colors: ["#FF6B6B","#FF8E53","#FFC853","#FFE66D","#A8E6CF"] },
  ocean:    { label: "Ocean",    colors: ["#0077B6","#00B4D8","#48CAE4","#90E0EF","#ADE8F4"] },
  forest:   { label: "Forest",   colors: ["#2D6A4F","#40916C","#52B788","#74C69D","#B7E4C7"] },
  lavender: { label: "Lavender", colors: ["#7B2D8E","#9B59B6","#BB8FCE","#D2B4DE","#EBDEF0"] },
  ember:    { label: "Ember",    colors: ["#D62828","#E85D04","#F48C06","#FAA307","#FCBF49"] },
  mono:     { label: "Mono",     colors: ["#333","#555","#777","#999","#BBB"] },
};

export const GUIDE_COLORS = {
  yellow: { label: "Yellow", highlight: "rgba(255,235,59,0.38)", underline: "#FFD600", dot: "#FFD600" },
  blue:   { label: "Blue",   highlight: "rgba(66,165,245,0.32)",  underline: "#42A5F5", dot: "#42A5F5" },
  green:  { label: "Green",  highlight: "rgba(102,187,106,0.32)", underline: "#66BB6A", dot: "#66BB6A" },
  pink:   { label: "Pink",   highlight: "rgba(236,64,122,0.28)",  underline: "#EC407A", dot: "#EC407A" },
  orange: { label: "Orange", highlight: "rgba(255,167,38,0.35)",  underline: "#FFA726", dot: "#FFA726" },
  purple: { label: "Purple", highlight: "rgba(171,71,188,0.30)",  underline: "#AB47BC", dot: "#AB47BC" },
  accent: { label: "Theme",  highlight: null, underline: null, dot: null },
};

export const FONTS = [
  { name: "Literata",              css: "'Literata', Georgia, serif",         href: "Literata:ital,wght@0,400;0,600;0,700;1,400" },
  { name: "Atkinson Hyperlegible", css: "'Atkinson Hyperlegible', sans-serif", href: "Atkinson+Hyperlegible:wght@400;700" },
  { name: "IBM Plex Serif",       css: "'IBM Plex Serif', serif",            href: "IBM+Plex+Serif:ital,wght@0,400;0,600;0,700;1,400" },
  { name: "Source Sans 3",        css: "'Source Sans 3', sans-serif",         href: "Source+Sans+3:wght@400;600;700" },
  { name: "Merriweather",         css: "'Merriweather', serif",              href: "Merriweather:ital,wght@0,400;0,700;1,400" },
  { name: "OpenDyslexic",         css: "'OpenDyslexic', sans-serif",          href: null },
];

export const FREE_UPLOAD_LIMIT = 3;
export const TRIAL_DAYS = 14;
export const MAX_RECENT_DOCS = 5;

export const DEMO_TEXT = `Chapter 1: The Science of Reading

In an age of constant digital distraction, the ability to read deeply and attentively has become one of the most valuable skills a person can cultivate. Deep reading is not merely the act of scanning words on a page — it is an immersive cognitive experience that engages memory, imagination, and critical analysis simultaneously.

Research in cognitive neuroscience has shown that sustained reading activates complex neural networks across both hemispheres of the brain. The left hemisphere processes language and logic, while the right hemisphere contributes emotional understanding and visual imagination. Together, they create a rich internal experience that no other medium can replicate.

Chapter 2: Visual Anchoring

The concept of "bionic reading" — where the first portion of each word is bolded to create visual anchors — emerged from research into how the eye moves during reading. Our eyes don't flow smoothly across text; instead, they make rapid jumps called saccades, landing on fixation points roughly every seven to nine characters.

Color-gradient line tracking is another technique rooted in accessibility research. By subtly shifting hue across each line of text, readers gain an additional spatial cue that helps prevent line-skipping.

Chapter 3: Typography and Comfort

Typography itself plays a crucial role in reading comfort. Line height, letter spacing, and column width all affect how easily the eye can track across and between lines. Research suggests that optimal line length falls between 50 and 75 characters.

Focus modes that dim surrounding paragraphs leverage a psychological principle called selective attention. By reducing visual noise around the current paragraph, the reader's cognitive resources can be more fully directed toward comprehension.

Chapter 4: The Future of Reading

The future of reading technology lies not in replacing the book, but in making the reading experience more accessible and adaptable. Every reader's brain is different, and the best reading tools are those that bend to the reader — not the other way around.`;
