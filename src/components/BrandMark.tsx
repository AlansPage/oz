type Props = {
  size?: number;
};

export function BrandMark({ size = 56 }: Props) {
  const fontSize = Math.round(size * 0.64);
  const radius = Math.round(size * 0.25);
  return (
    <div
      className="oz-brand-mark"
      style={{
        width: size,
        height: size,
        fontSize,
        borderRadius: radius,
      }}
      aria-hidden
    >
      ö
    </div>
  );
}
