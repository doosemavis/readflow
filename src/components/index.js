export { Toggle, Slider, Segment, Section, FontPicker, Tip } from "./Primitives";
export { DiaTextReveal } from "./DiaTextReveal";
export { default as UploadBadge } from "./UploadBadge";
export { SidebarRecentDocs, LandingRecentDocs } from "./RecentDocsList";
export { default as DocumentBody } from "./DocumentBody";
export { useReadingGuide } from "./ReadingGuideOverlay";
export { default as UserMenu } from "./UserMenu";
export { default as CatLoader } from "./CatLoader";
export { default as PulsatingButton } from "./PulsatingButton";
// Modals (PricingModal, PaywallModal, CheckoutModal, AuthModal, AdminPanel,
// AvatarSettingsModal) are intentionally NOT re-exported here. They're
// loaded lazily via React.lazy in App.jsx — re-exporting them through this
// barrel would pull them back into the static dependency graph and defeat
// the code-split. Import them directly from their files when needed.
