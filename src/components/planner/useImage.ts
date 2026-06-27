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
