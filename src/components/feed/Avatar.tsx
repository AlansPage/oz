type Props = {
  url?: string | null;
  name?: string | null;
  phone?: string | null;
  size?: "sm" | "lg";
};

function initial(name?: string | null, phone?: string | null): string {
  const source = name?.trim() || phone?.trim();
  if (!source) return "?";
  const first = source.match(/[A-Za-zА-Яа-яЁё0-9]/);
  return (first?.[0] ?? "?").toUpperCase();
}

export function Avatar({ url, name, phone, size = "sm" }: Props) {
  const cls = size === "lg" ? "oz-avatar oz-avatar--lg" : "oz-avatar";
  if (url) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" className={cls} />;
  }
  return <div className={cls} aria-hidden>{initial(name, phone)}</div>;
}
