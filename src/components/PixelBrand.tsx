interface Props {
  className?: string;
}

export default function PixelBrand({ className }: Props) {
  return (
    <span className={`pixel-brand${className ? ` ${className}` : ""}`} aria-hidden="true">
      <svg
        className="pixel-brand-mark"
        viewBox="0 0 24 24"
        focusable="false"
        shapeRendering="crispEdges"
      >
        <path className="pixel-brand-frame" d="M1 1h22v22H1zM3 3v18h18V3z" />
        <path className="pixel-brand-pixels pixel-brand-pixels-a" d="M5 5h6v6H5zM13 5h6v6h-6zM5 13h6v6H5zM13 13h6v6h-6z" />
        <path className="pixel-brand-pixels pixel-brand-pixels-b" d="M5 5h6v6H5zM13 7h6v6h-6zM5 13h6v6H5zM13 15h6v4h-6z" />
      </svg>
      <span className="pixel-brand-word">
        <span>Blog</span><strong>X_x</strong>
      </span>
      <span className="pixel-brand-rule" />
    </span>
  );
}
