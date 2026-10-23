// Tanda produk: kotak gelap dengan segitiga "play" (playground). Satu SVG kecil, tanpa gambar eksternal.
export default function Mark({ size = 20 }: Readonly<{ size?: number }>) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true" focusable="false" className="mark">
      <rect width="20" height="20" rx="5" fill="currentColor" />
      <path d="M7.5 5.8v8.4l6.6-4.2z" fill="var(--bg)" />
    </svg>
  );
}
