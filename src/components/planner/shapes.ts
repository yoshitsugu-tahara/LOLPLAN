import { nanoid } from "nanoid";

/** 描画ツール */
export type Tool = "select" | "pen" | "arrow" | "line" | "text" | "eraser";

/** マップ上に置くトークン（中心が x,y） */
export interface TokenShape {
  id: string;
  type: "token";
  x: number;
  y: number;
  size: number;
  src: string; // http/絶対パス=画像、それ以外=絵文字/文字
  color: string; // リング色(hex)
  label: string;
  fit: "cover" | "contain"; // 画像の収め方
}

/** ペン(自由線)/直線/矢印 */
export interface DrawShape {
  id: string;
  type: "pen" | "line" | "arrow";
  points: number[]; // ページ座標の連続点 [x,y,x,y,...]
  color: string; // hex
  width: number;
}

/** テキスト */
export interface TextShape {
  id: string;
  type: "text";
  x: number;
  y: number;
  text: string;
  color: string;
  fontSize: number;
}

export type Shape = TokenShape | DrawShape | TextShape;

export const newId = () => nanoid(10);

/** 画像URLか（emoji/文字との判別） */
export const isImageSrc = (s: string) =>
  s.startsWith("http") || s.startsWith("/");
