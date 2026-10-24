import type { MenuPhoto } from "../../supabase/functions/_shared/menu-domain";
export function menuWithRows(
  count: number,
  id = "90000000-0000-4000-8000-000000000001",
): MenuPhoto {
  return {
    id,
    imageRevision: 1,
    width: 1200,
    height: 1600,
    engine: "apple-vision-v1",
    lines: Array.from({ length: count }, (_, n) => ({
      id: `${id}:1:${n}`,
      text: `합성 메뉴 ${n + 1} 10,000원`,
      confidence: 0.9,
      polygon: [
        { x: 0.1, y: 0.005 + n * 0.008 },
        { x: 0.8, y: 0.005 + n * 0.008 },
        { x: 0.8, y: 0.009 + n * 0.008 },
        { x: 0.1, y: 0.009 + n * 0.008 },
      ],
    })),
  };
}
