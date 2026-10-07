import { useEffect, useRef, useState } from "react";

type Props = { title: string; coverImage?: string; coverAlt?: string; demoUrl?: string };

export default function ProjectPreview({ title, coverImage, coverAlt, demoUrl }: Props) {
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);
  const source = playing ? demoUrl : coverImage;
  useEffect(() => {
    if (imageRef.current?.complete && !imageRef.current.naturalWidth) setFailed(true);
  }, [source]);
  return (
    <figure className="project-media">
      <div className="project-media-stage">
        {source && !failed ? <img key={source} ref={imageRef} src={source} alt={coverAlt || `${title} 项目预览`}
          width="1280" height="800" loading="lazy" decoding="async" onError={() => setFailed(true)} />
          : <div className="project-media-fallback"><span>{title}</span><p>{failed ? "预览暂时无法加载，可通过仓库查看项目" : "项目演示"}</p></div>}
      </div>
      <figcaption>
        <span>{playing ? "README 演示" : "项目预览"}</span>
        {demoUrl && <button type="button" aria-pressed={playing} onClick={() => { setFailed(false); setPlaying(!playing); }}>
          {playing ? "停止演示" : "播放演示 ↗"}
        </button>}
      </figcaption>
    </figure>
  );
}
