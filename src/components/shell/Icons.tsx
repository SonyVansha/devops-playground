// Satu set ikon outline 16px (stroke 1.5), dipakai untuk navigasi dan satu-satu aksi. Tanpa library ikon.
const PATHS = {
  overview: (
    <>
      <rect x="2" y="2" width="5" height="5" rx="1" />
      <rect x="9" y="2" width="5" height="5" rx="1" />
      <rect x="2" y="9" width="5" height="5" rx="1" />
      <rect x="9" y="9" width="5" height="5" rx="1" />
    </>
  ),
  catalog: <path d="M3 4h10M3 8h10M3 12h6" />,
  chaos: <path d="M9 1.5 3.5 9H8l-1 5.5L12.5 7H8z" />,
  database: (
    <>
      <ellipse cx="8" cy="4" rx="5" ry="2" />
      <path d="M3 4v8c0 1.1 2.2 2 5 2s5-.9 5-2V4M3 8c0 1.1 2.2 2 5 2s5-.9 5-2" />
    </>
  ),
  docs: <path d="M3 2.5h7a2 2 0 0 1 2 2v9H5a2 2 0 0 1-2-2zM3 11.5a2 2 0 0 1 2-2h7" />,
  menu: <path d="M2.5 4.5h11M2.5 8h11M2.5 11.5h11" />,
  close: <path d="M4 4l8 8M12 4l-8 8" />,
  back: <path d="M9.5 3.5 5 8l4.5 4.5" />,
  copy: (
    <>
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" />
      <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
    </>
  ),
  play: <path d="M5.5 3.5v9l7-4.5z" />,
  plus: <path d="M8 3v10M3 8h10" />,
  refresh: <path d="M13 8a5 5 0 1 1-1.6-3.7M13 2.5v3h-3" />,
} as const;

export type IconName = keyof typeof PATHS;

export function Icon({ name, size = 16 }: Readonly<{ name: IconName; size?: number }>) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className="icon"
    >
      {PATHS[name]}
    </svg>
  );
}
