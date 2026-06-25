"use client";

import { HTMLContainer, Rectangle2d, ShapeUtil, T, type TLShape } from "tldraw";

export type TokenKind = "champion" | "ward" | "objective" | "map";

/** マップ上に置く汎用トークンの props */
export interface TokenProps {
  w: number;
  h: number;
  kind: TokenKind;
  src: string; // 画像URL（http...）または絵文字
  color: string; // リング/アクセント色
  label: string; // トークン下のラベル
}

// tldraw にカスタムshape "token" を型登録する（公式の宣言マージ方式）
declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    token: TokenProps;
  }
}

/** マップ上に置く汎用トークン（チャンピオン/ワード/オブジェクト/背景マップ） */
export type TokenShape = TLShape<"token">;

export class TokenShapeUtil extends ShapeUtil<TokenShape> {
  static override type = "token" as const;
  static override props = {
    w: T.number,
    h: T.number,
    kind: T.string,
    src: T.string,
    color: T.string,
    label: T.string,
  };

  override getDefaultProps(): TokenShape["props"] {
    return {
      w: 44,
      h: 44,
      kind: "champion",
      src: "",
      color: "#3b82f6",
      label: "",
    };
  }

  override getGeometry(shape: TokenShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override getIndicatorPath(shape: TokenShape) {
    const { w, h, kind } = shape.props;
    const path = new Path2D();
    if (kind === "map") {
      path.rect(0, 0, w, h);
    } else {
      path.ellipse(w / 2, h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    }
    return path;
  }

  override canEdit() {
    return false;
  }
  override hideRotateHandle() {
    return true;
  }
  override isAspectRatioLocked() {
    return true;
  }

  override component(shape: TokenShape) {
    const { w, h, kind, src, color, label } = shape.props;
    // http(s) URL もしくはローカルパス(/...)は画像、それ以外は絵文字として描画
    const isImg = src.startsWith("http") || src.startsWith("/");

    // 背景マップ：常に画像。選択UIを邪魔しないよう pointer-events を無効化
    if (kind === "map") {
      return (
        <HTMLContainer style={{ width: w, height: h, pointerEvents: "none" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt=""
            draggable={false}
            style={{
              width: "100%",
              height: "100%",
              objectFit: "cover",
              borderRadius: 10,
              userSelect: "none",
            }}
          />
        </HTMLContainer>
      );
    }

    return (
      <HTMLContainer style={{ width: w, height: h, pointerEvents: "all" }}>
        <div
          style={{
            width: "100%",
            height: "100%",
            borderRadius: "50%",
            border: `2.5px solid ${color}`,
            boxShadow: "0 2px 6px rgba(0,0,0,.45)",
            background: isImg ? "#0b0e14" : `${color}26`,
            overflow: "hidden",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {isImg ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={src}
              alt={label}
              draggable={false}
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: Math.round(h * 0.55), lineHeight: 1 }}>
              {src}
            </span>
          )}
        </div>
        {label && (
          <div
            style={{
              position: "absolute",
              top: "100%",
              left: "50%",
              transform: "translateX(-50%)",
              marginTop: 2,
              padding: "0 4px",
              fontSize: 11,
              fontWeight: 700,
              whiteSpace: "nowrap",
              color: "#fff",
              textShadow: "0 1px 2px #000, 0 0 3px #000",
              pointerEvents: "none",
            }}
          >
            {label}
          </div>
        )}
      </HTMLContainer>
    );
  }

  override indicator(shape: TokenShape) {
    const { w, h, kind } = shape.props;
    if (kind === "map") return <rect width={w} height={h} rx={10} />;
    return <circle cx={w / 2} cy={h / 2} r={w / 2} />;
  }
}
