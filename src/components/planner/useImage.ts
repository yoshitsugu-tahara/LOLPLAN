import { useEffect, useState } from "react";

/** src から HTMLImageElement を読み込む（Konva.Image 用） */
export function useImage(src: string | undefined) {
  const [image, setImage] = useState<HTMLImageElement | undefined>();
  useEffect(() => {
    if (!src) {
      setImage(undefined);
      return;
    }
    const img = new window.Image();
    // CORS対応で読み込むと canvas が汚染されず stage.toDataURL（プレビュー）が通る。
    // ddragon は ACAO:* を返し、同一オリジン画像にも無害。
    img.crossOrigin = "anonymous";
    let active = true;
    img.onload = () => active && setImage(img);
    img.onerror = () => active && setImage(undefined);
    img.src = src;
    return () => {
      active = false;
    };
  }, [src]);
  return image;
}
