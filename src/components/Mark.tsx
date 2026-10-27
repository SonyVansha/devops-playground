// Tanda produk: garis detak, merujuk pada probe yang terus dibaca. Satu SVG kecil, tanpa gambar eksternal.
export default function Mark({ size = 20 }: Readonly<{ size?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="mark">
      <rect width="20" height="20" rx="5" fill="currentColor" />
      <path d="M3.5 10.5h3l1.8-4.5 3.2 8 1.8-3.5h3.2" fill="none" stroke="var(--bg)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
