/** YouTube / Twitch のURLを埋め込み用URLに変換する。対応外なら null */
export function toEmbedUrl(raw: string): string | null {
  let u: URL;
  try {
    u = new URL(raw.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "");
  const parent =
    typeof window !== "undefined" ? window.location.hostname : "localhost";

  // YouTube
  if (host === "youtu.be") {
    const id = u.pathname.slice(1);
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }
  if (host === "youtube.com" || host === "m.youtube.com") {
    if (u.pathname.startsWith("/embed/")) return raw;
    if (u.pathname.startsWith("/shorts/")) {
      return `https://www.youtube.com/embed/${u.pathname.split("/")[2]}`;
    }
    const id = u.searchParams.get("v");
    return id ? `https://www.youtube.com/embed/${id}` : null;
  }

  // Twitch
  if (host === "twitch.tv") {
    const vid = u.pathname.match(/\/videos\/(\d+)/);
    if (vid) {
      return `https://player.twitch.tv/?video=${vid[1]}&parent=${parent}&autoplay=false`;
    }
    const clip = u.pathname.match(/\/clip\/([^/]+)/);
    if (clip) {
      return `https://clips.twitch.tv/embed?clip=${clip[1]}&parent=${parent}&autoplay=false`;
    }
    const channel = u.pathname.split("/")[1];
    if (channel) {
      return `https://player.twitch.tv/?channel=${channel}&parent=${parent}&autoplay=false`;
    }
  }
  if (host === "clips.twitch.tv") {
    const slug = u.pathname.slice(1);
    if (slug) {
      return `https://clips.twitch.tv/embed?clip=${slug}&parent=${parent}&autoplay=false`;
    }
  }

  return null;
}
