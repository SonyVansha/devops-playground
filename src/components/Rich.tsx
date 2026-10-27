// Teks pendek dengan `kode` dan **tebal**, dirender sebagai node React (tidak pernah HTML mentah).
// Dipakai untuk kalimat di kamus terjemahan yang memuat nama env, path, atau perintah.
export default function Rich({ text }: Readonly<{ text: string }>) {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g).filter(Boolean);
  return (
    <>
      {parts.map((part, i) => {
        if (part.startsWith('`')) return <code key={i}>{part.slice(1, -1)}</code>;
        if (part.startsWith('**')) return <strong key={i}>{part.slice(2, -2)}</strong>;
        return <span key={i}>{part}</span>;
      })}
    </>
  );
}
