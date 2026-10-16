/*-- 「服务器」机箱岛（S1）：底模舞台容器
   交互骨架（拾取/标注/卡片/拉近细节）在 S4/S5 叠加；本期交付 tab + 底模。
   Note: see .agents/notes/2026-10-15-server-tab-linecase-requirement--103be143.md --*/

import { useEffect, useRef, useState } from "react";
import type { ServerSceneApi } from "./server-case-scene";

export default function ServerCase() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sceneRef = useRef<ServerSceneApi | null>(null);
  const [drawn, setDrawn] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    let cancelled = false;
    (async () => {
      const { createServerCaseScene } = await import("./server-case-scene");
      if (cancelled) return;
      const api = await createServerCaseScene(canvas);
      sceneRef.current = api;
      api.resize();
      api.whenDrawn.then(() => {
        if (!cancelled) setDrawn(true);
      });
    })();
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
  }, []);

  useEffect(() => {
    const onResize = () => sceneRef.current?.resize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  return (
    <div className="server-case">
      <canvas ref={canvasRef} className="server-canvas" aria-label="可拖拽旋转、滚轮缩放的机箱结构模型" />
      <p className={`server-hint${drawn ? " is-ready" : ""}`}>拖拽观察 · 滚轮缩放</p>
    </div>
  );
}
