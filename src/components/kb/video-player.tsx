import { videoEmbedUrl } from "@/lib/video-embed";

/** A lesson video: hosted links (YouTube, Vimeo, Loom, Google Drive) as an embedded player, files in a <video> tag. */
export function VideoPlayer({ src, title, className = "" }: { src: string; title: string; className?: string }) {
  const embed = videoEmbedUrl(src);
  return embed ? (
    <iframe
      src={embed}
      title={title}
      className={`w-full aspect-video bg-black block ${className}`}
      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
      allowFullScreen
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
    />
  ) : (
    <video src={`${src}#t=0.5`} controls playsInline preload="metadata" controlsList="nodownload" className={`w-full aspect-video bg-black block ${className}`} />
  );
}
