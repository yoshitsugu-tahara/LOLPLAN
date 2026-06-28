// 関連動画(同チャンネルのみ)・注釈オフ・字幕の自動表示オフ・ブランディング
// 控えめで、動画に重なるYouTube側のUIをできるだけ減らす。
const YT_PARAMS =
  "rel=0&modestbranding=1&iv_load_policy=3&cc_load_policy=0&color=white";

function ytEmbed(id: string, clean = false): string {
  // youtube-nocookie でトラッキングも抑えつつクリーンに表示。
  // clean=コントロールバーごと非表示（シンプル表示）
  const params = clean ? `${YT_PARAMS}&controls=0` : YT_PARAMS;
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}

/** YouTube 動画IDを取り出す（YouTube以外は null） */
export function youtubeId(raw: string): string | null {
  try {
    const u = new URL(raw.trim());
    const host = u.hostname.replace(/^www\./, "");
    if (host === "youtu.be") return u.pathname.slice(1) || null;
    if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname.startsWith("/embed/") || u.pathname.startsWith("/shorts/")) {
        return u.pathname.split("/")[2] || null;
      }
      return u.searchParams.get("v");
    }
  } catch {
    // ignore
  }
  return null;
}

/** クリックで再生する自前ポスター用のサムネURL */
export function youtubeThumb(id: string): string {
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** YouTube / Twitch のURLを埋め込み用URLに変換する。対応外なら null。
 *  clean=true でコントロールバーごと非表示（シンプル表示）。 */
export function toEmbedUrl(raw: string, clean = false): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parent =
    typeof window !== "undefined" ? window.location.hostname : "localhost";
  const tw = clean ? "&controls=false" : "";

  // YouTube
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? ytEmbed(id, clean) : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com" || host === "youtube-nocookie.com") {
    if (u.pathname.startsWith("/embed/")) {
      const id = u.pathname.split("/")[2];
      return id ? ytEmbed(id, clean) : null;
    }
    if (u.pathname.startsWith("/shorts/")) {
      const id = u.pathname.split("/")[2];
      return id ? ytEmbed(id, clean) : null;
    }
    const id = u.searchParams.get("v");
    return id ? ytEmbed(id, clean) : null;
  }

  // Twitch
  if (host === "twitch.tv") {
    const vid = u.pathname.match(/\/videos\/(\d+)/);
    if (vid) {
      return `https://player.twitch.tv/?video=${vid[1]}&parent=${parent}&autoplay=false${tw}`;
    }
    const clip = u.pathname.match(/\/clip\/([^/]+)/);
    if (clip) {
      return `https://clips.twitch.tv/embed?clip=${clip[1]}&parent=${parent}&autoplay=false${tw}`;
    }
    const channel = u.pathname.split("/")[1];
    if (channel) {
      return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=false${tw}`;
    }
  }
  if (host === "clips.twitch.tv") {
    const slug = u.pathname.slice(1);
    if (slug) {
      return `https://clips.twitch.tv/embed?clip=${slug}&parent=${parent}&autoplay=false${tw}`;
    }
  }

  return null;
}
