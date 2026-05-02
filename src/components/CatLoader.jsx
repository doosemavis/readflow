// Cat loader, ported from https://codepen.io/Rplus/pen/PWZYRM (Rplus, after domaso/林天翼).
// Pure CSS sprite-rotation animation. Sprite is bundled (src/assets/cat-loader.png), so the
// loader renders instantly without a network round-trip — important since this UI is shown
// precisely when the user is waiting on something.
import catLoaderImg from "../assets/cat-loader.png";

export default function CatLoader({ size = 220, style }) {
  return (
    <div
      className="rf-cat"
      role="status"
      aria-label="Loading"
      style={{
        ["--rf-cat-img"]: `url(${catLoaderImg})`,
        ["--rf-cat-size"]: `${size}px`,
        ...style,
      }}
    >
      <div className="rf-cat__body" />
      <div className="rf-cat__body" />
      <div className="rf-cat__tail" />
      <div className="rf-cat__head" />
    </div>
  );
}
