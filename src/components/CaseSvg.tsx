/*-- 纸板壳机箱插画（纯 SVG，视口 860×720，与 hero 变形网格对齐）
   画风：牛皮纸板模型 — 折边、齿孔切口、胶带、丝印标注、瓦楞切面
   Note: 机箱 Hero 设计规格 — see .agents/notes/2026-10-14-home-case-hero-requirement--154e01dc.md --*/

export type PartKey = "cpu" | "gpu" | "lcd" | "fans" | "psu";

type Props = {
  counts: Record<string, number>;
  activePart: PartKey | null;
  hoverPart: PartKey | null;
  onPartClick: (part: PartKey) => void;
  onPartHover: (part: PartKey | null) => void;
};

/* 纸板色板（红橙牛皮 · 2026-10-14 画风定稿；印色为深可可与奶油白，ox 血红留给标注层） */
const K = {
  face: "#e0703f",
  faceLight: "#f0a878",
  tray: "#c85a30",
  edge: "#a84422",
  deep: "#7e2f14",
  ink: "#4a1a0e",
  cream: "#f8e8d8",
  screen: "#2c140c",
};

/* 五个部件的发光描记区域（纸板件本体） */
const GLOWS: Record<PartKey, { cx: number; cy: number; rx: number; ry: number }> = {
  cpu: { cx: 302, cy: 228, rx: 78, ry: 62 },
  gpu: { cx: 352, cy: 362, rx: 130, ry: 42 },
  lcd: { cx: 374, cy: 472, rx: 92, ry: 48 },
  fans: { cx: 572, cy: 342, rx: 58, ry: 150 },
  psu: { cx: 362, cy: 578, rx: 118, ry: 44 },
};

/* 引线标注：终点落在纸面上（图外左右） */
export const CALLOUTS: {
  part: PartKey;
  no: string;
  label: string;
  side: "left" | "right";
  dot: [number, number];
  end: [number, number];
}[] = [
  { part: "cpu",   no: "01", label: "CPU 一体式水冷头", side: "left",  dot: [302, 228], end: [185, 148] },
  { part: "gpu",   no: "02", label: "显卡 · 渲染单元",   side: "left",  dot: [352, 362], end: [185, 356] },
  { part: "lcd",   no: "03", label: "9.2\" LCD 仪表屏",  side: "left",  dot: [374, 472], end: [185, 512] },
  { part: "fans",  no: "04", label: "侧置风扇组",        side: "right", dot: [572, 342], end: [676, 248] },
  { part: "psu",   no: "05", label: "电源仓 PSU 舱",     side: "right", dot: [362, 578], end: [676, 610] },
];

export default function CaseSvg({ counts, activePart, hoverPart, onPartClick, onPartHover }: Props) {
  const lit: PartKey | null = hoverPart ?? activePart;

  return (
    <svg
      viewBox="0 0 860 720"
      className="case-svg"
      role="img"
      aria-label="纸板壳机箱结构图"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* 瓦楞切面 */}
        <pattern id="corrugation" width="8" height="10" patternUnits="userSpaceOnUse">
          <rect width="8" height="10" fill={K.deep} />
          <rect x="1.5" width="2" height="10" fill={K.edge} />
          <rect x="5" width="1.2" height="10" fill={K.edge} opacity="0.6" />
        </pattern>
        {/* 纸纹 */}
        <filter id="grain" x="-2%" y="-2%" width="104%" height="104%">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" result="n" />
          <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.29 0 0 0 0 0.21 0 0 0 0 0.13 0 0 0 0.05 0" />
          <feComposite operator="over" in2="SourceGraphic" />
        </filter>
        {/* 纸片投影 */}
        <filter id="paperShadow" x="-8%" y="-8%" width="118%" height="118%">
          <feDropShadow dx="6" dy="10" stdDeviation="9" floodColor="#3d2a16" floodOpacity="0.28" />
        </filter>
        {/* 奶油聚光：红橙纸板上 ox 血红光环对比不足，改暖白聚光 */}
        <radialGradient id="glowGrad" cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="#fff2dc" stopOpacity="0.55" />
          <stop offset="55%" stopColor="#fff2dc" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#fff2dc" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* ================= 机身纸板 ================= */}
      <g filter="url(#paperShadow)">
        {/* 顶盖折边（斜切纸舌） */}
        <path d="M200 118 L216 86 L676 86 L662 118 Z" fill={K.faceLight} stroke={K.edge} strokeWidth="2" />
        <path d="M216 86 L232 72 L660 72 L676 86 Z" fill={K.face} stroke={K.edge} strokeWidth="2" />
        <line x1="232" y1="79" x2="660" y2="79" stroke={K.edge} strokeWidth="1.2" strokeDasharray="7 5" opacity="0.7" />

        {/* 主体 */}
        <rect x="200" y="118" width="462" height="522" rx="8" fill={K.face} stroke={K.ink} strokeWidth="2.5" filter="url(#grain)" />

        {/* 右侧竖梁（纸板立柱，丝印铭文） */}
        <rect x="592" y="118" width="70" height="522" fill={K.faceLight} stroke={K.ink} strokeWidth="2" />
        <line x1="592" y1="118" x2="592" y2="640" stroke={K.edge} strokeWidth="1.5" />
        <text x="627" y="330" textAnchor="middle" fontSize="26" fontFamily="ui-monospace, monospace"
              fill={K.deep} letterSpacing="10" transform="rotate(90 627 330)" fontWeight="700">
          树 码 空 间
        </text>
        <text x="647" y="330" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace"
              fill={K.ink} letterSpacing="4" transform="rotate(90 647 330)" opacity="0.65">
          PAPER CASE MK-I · EST 2026
        </text>

        {/* 顶部丝印铭牌 */}
        <text x="228" y="150" fontSize="13" fontFamily="ui-monospace, monospace" fill={K.ink} fontWeight="700" letterSpacing="2">
          CASE-MK1 / 纸板壳
        </text>
        <text x="228" y="168" fontSize="9.5" fontFamily="ui-monospace, monospace" fill={K.ink} letterSpacing="1.5" opacity="0.7">
          SN 2026-10-14 · PERSONAL DIGITAL GARDEN
        </text>
      </g>

      {/* ================= 侧窗（挖空展示内构） ================= */}
      <rect x="218" y="186" width="356" height="356" rx="6" fill={K.tray} stroke={K.ink} strokeWidth="2" />
      {/* 托盘印刷网格 */}
      <g stroke={K.edge} strokeWidth="1" opacity="0.55">
        <line x1="218" y1="272" x2="574" y2="272" strokeDasharray="4 6" />
        <line x1="218" y1="414" x2="574" y2="414" strokeDasharray="4 6" />
        <line x1="366" y1="186" x2="366" y2="542" strokeDasharray="4 6" />
      </g>
      {/* 窗框胶带 */}
      <g opacity="0.85">
        <rect x="204" y="172" width="64" height="20" fill="#e8d3ae" stroke={K.edge} strokeWidth="1" transform="rotate(-18 236 182)" />
        <rect x="528" y="172" width="64" height="20" fill="#e8d3ae" stroke={K.edge} strokeWidth="1" transform="rotate(14 560 182)" />
        <rect x="204" y="534" width="64" height="20" fill="#e8d3ae" stroke={K.edge} strokeWidth="1" transform="rotate(12 236 544)" />
      </g>

      {/* ================= 01 · CPU 水冷头 ================= */}
      <g
        className={"case-part" + (lit === "cpu" ? " lit" : "")}
        onClick={() => onPartClick("cpu")}
        onMouseEnter={() => onPartHover("cpu")}
        onMouseLeave={() => onPartHover(null)}
      >
        {/* 冷排 */}
        <rect x="238" y="196" width="128" height="18" rx="3" fill={K.edge} stroke={K.ink} strokeWidth="1.5" />
        {[0, 1, 2, 3, 4, 5, 6].map((i) => (
          <line key={i} x1={246 + i * 17} y1="199" x2={246 + i * 17} y2="211" stroke={K.deep} strokeWidth="2" />
        ))}
        {/* 泵头纸盒 */}
        <rect x="252" y="236" width="100" height="72" rx="5" fill={K.faceLight} stroke={K.ink} strokeWidth="2" />
        <path d="M252 236 L268 220 L368 220 L352 236 Z" fill={K.face} stroke={K.ink} strokeWidth="1.5" />
        <circle cx="302" cy="270" r="26" fill={K.tray} stroke={K.ink} strokeWidth="2" />
        <circle cx="302" cy="270" r="15" fill="none" stroke={K.cream} strokeWidth="2.5" />
        <circle cx="302" cy="270" r="5" fill={K.ink} />
        <text x="302" y="326" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill={K.ink} letterSpacing="1.5">
          CPU-N1 · 思考核心
        </text>
      </g>

      {/* ================= 02 · 显卡（渲染单元） ================= */}
      <g
        className={"case-part" + (lit === "gpu" ? " lit" : "")}
        onClick={() => onPartClick("gpu")}
        onMouseEnter={() => onPartHover("gpu")}
        onMouseLeave={() => onPartHover(null)}
      >
        <rect x="238" y="330" width="236" height="58" rx="5" fill={K.faceLight} stroke={K.ink} strokeWidth="2" />
        <path d="M238 330 L252 316 L488 316 L474 330 Z" fill={K.face} stroke={K.ink} strokeWidth="1.5" />
        {[0, 1].map((i) => (
          <g key={i}>
            <circle cx={292 + i * 84} cy={359} r="21" fill={K.tray} stroke={K.ink} strokeWidth="1.8" />
            <circle cx={292 + i * 84} cy={359} r="6" fill={K.ink} />
            {[0, 1, 2, 3, 4, 5].map((b) => (
              <line
                key={b}
                x1={292 + i * 84}
                y1={359}
                x2={292 + i * 84 + 16 * Math.cos((b * Math.PI) / 3)}
                y2={359 + 16 * Math.sin((b * Math.PI) / 3)}
                stroke={K.ink}
                strokeWidth="2"
                opacity="0.7"
              />
            ))}
          </g>
        ))}
        <text x="430" y="352" fontSize="9.5" fontFamily="ui-monospace, monospace" fill={K.ink} fontWeight="700" letterSpacing="1">
          RENDER
        </text>
        <text x="430" y="368" fontSize="9.5" fontFamily="ui-monospace, monospace" fill={K.ink} fontWeight="700" letterSpacing="1">
          UNIT-R1
        </text>
      </g>

      {/* ================= 03 · LCD 仪表屏 ================= */}
      <g
        className={"case-part" + (lit === "lcd" ? " lit" : "")}
        onClick={() => onPartClick("lcd")}
        onMouseEnter={() => onPartHover("lcd")}
        onMouseLeave={() => onPartHover(null)}
      >
        <rect x="292" y="434" width="164" height="84" rx="4" fill={K.screen} stroke={K.ink} strokeWidth="2.5" />
        <rect x="299" y="441" width="150" height="70" rx="2" fill="#1c1510" />
        <text x="307" y="456" fontSize="8" fontFamily="ui-monospace, monospace" fill="#b93b28" letterSpacing="1.5">
          GARDEN STATUS
        </text>
        <text x="307" y="478" fontSize="13" fontFamily="ui-monospace, monospace" fill="#e8d3ae">
          POSTS {String(counts.posts ?? 0).padStart(2, "0")}
        </text>
        <text x="307" y="496" fontSize="13" fontFamily="ui-monospace, monospace" fill="#e8d3ae">
          KB {String(counts.knowledgeBase ?? 0).padStart(2, "0")}
        </text>
        <text x="385" y="478" fontSize="13" fontFamily="ui-monospace, monospace" fill="#b93b28">
          WIKI {String(counts.wiki ?? 0).padStart(2, "0")}
        </text>
        <text x="385" y="496" fontSize="13" fontFamily="ui-monospace, monospace" fill="#e8d3ae">
          ALL {String(
            (counts.posts ?? 0) + (counts.knowledgeBase ?? 0) + (counts.wiki ?? 0) +
            (counts.repos ?? 0) + (counts.projects ?? 0) + (counts.skills ?? 0) + (counts.toolbox ?? 0)
          ).padStart(2, "0")}
        </text>
        <text x="374" y="532" textAnchor="middle" fontSize="9" fontFamily="ui-monospace, monospace" fill={K.ink} letterSpacing="1.5">
          LCD-9.2 · 实时仪表
        </text>
      </g>

      {/* ================= 04 · 侧置风扇组 ================= */}
      <g
        className={"case-part" + (lit === "fans" ? " lit" : "")}
        onClick={() => onPartClick("fans")}
        onMouseEnter={() => onPartHover("fans")}
        onMouseLeave={() => onPartHover(null)}
      >
        {[0, 1, 2].map((i) => (
          <g key={i}>
            <circle cx="572" cy={248 + i * 94} r="34" fill={K.faceLight} stroke={K.ink} strokeWidth="2" />
            <circle cx="572" cy={248 + i * 94} r="12" fill={K.tray} stroke={K.ink} strokeWidth="1.5" />
            {[0, 1, 2, 3, 4, 5, 6].map((b) => (
              <path
                key={b}
                d={`M572 ${248 + i * 94} q ${10 * Math.cos((b * 2 * Math.PI) / 7 - 0.5)} ${10 * Math.sin((b * 2 * Math.PI) / 7 - 0.5)} ${22 * Math.cos((b * 2 * Math.PI) / 7)} ${22 * Math.sin((b * 2 * Math.PI) / 7)}`}
                fill="none"
                stroke={K.ink}
                strokeWidth="1.6"
                opacity="0.6"
              />
            ))}
            <circle cx="572" cy={248 + i * 94} r="34" fill="none" stroke={K.deep} strokeWidth="1.2" strokeDasharray="3 5" opacity="0.7" />
          </g>
        ))}
      </g>

      {/* ================= 05 · 电源仓 ================= */}
      <g
        className={"case-part" + (lit === "psu" ? " lit" : "")}
        onClick={() => onPartClick("psu")}
        onMouseEnter={() => onPartHover("psu")}
        onMouseLeave={() => onPartHover(null)}
      >
        <rect x="238" y="548" width="248" height="66" rx="5" fill={K.faceLight} stroke={K.ink} strokeWidth="2" />
        <path d="M238 548 L252 534 L500 534 L486 548 Z" fill={K.face} stroke={K.ink} strokeWidth="1.5" />
        <text x="258" y="578" fontSize="11" fontFamily="ui-monospace, monospace" fill={K.ink} fontWeight="700" letterSpacing="2">
          PSU-650
        </text>
        <text x="258" y="598" fontSize="9" fontFamily="ui-monospace, monospace" fill={K.ink} letterSpacing="1.5" opacity="0.75">
          能量来源 · 关于我 + 灵感箱
        </text>
        <circle cx="452" cy="581" r="16" fill="none" stroke={K.ink} strokeWidth="2.5" />
        <line x1="452" y1="562" x2="452" y2="575" stroke={K.ink} strokeWidth="3" />
      </g>

      {/* ================= 纸板细节层 ================= */}
      {/* 底部瓦楞切面 */}
      <rect x="200" y="636" width="462" height="12" fill="url(#corrugation)" stroke={K.ink} strokeWidth="1.5" />
      {/* 左侧折线与齿孔 */}
      <line x1="210" y1="130" x2="210" y2="630" stroke={K.edge} strokeWidth="1.2" strokeDasharray="6 6" opacity="0.6" />
      <g fill={K.deep} opacity="0.8">
        {[0, 1, 2, 3, 4, 5, 6, 7].map((i) => (
          <rect key={i} x="196" y={190 + i * 54} width="8" height="10" rx="2" />
        ))}
      </g>
      {/* 丝印贴纸 */}
      <g transform="rotate(-8 250 600)">
        <rect x="216" y="566" width="66" height="28" fill={K.deep} stroke={K.ink} strokeWidth="1.5" />
        <text x="249" y="585" textAnchor="middle" fontSize="10" fontFamily="ui-monospace, monospace" fill={K.cream} fontWeight="700" letterSpacing="1">
          机器之心
        </text>
      </g>
      {/* 尺寸刻度（纸模裁切线语言） */}
      <g stroke={K.ink} strokeWidth="1.2" opacity="0.5">
        <line x1="200" y1="104" x2="662" y2="104" />
        {[0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
          <line key={i} x1={200 + i * 57.75} y1="99" x2={200 + i * 57.75} y2="109" />
        ))}
      </g>
      {/* 电源线纸绳 */}
      <path d="M486 600 C 520 620, 530 640, 512 660 C 496 676, 470 668, 476 652"
            fill="none" stroke={K.deep} strokeWidth="5" strokeLinecap="round" />
      <path d="M486 600 C 520 620, 530 640, 512 660 C 496 676, 470 668, 476 652"
            fill="none" stroke={K.edge} strokeWidth="1.5" strokeDasharray="4 4" />

      {/* ================= 发光描记（高精度交互） ================= */}
      {lit && (
        <ellipse
          className="part-glow-svg"
          cx={GLOWS[lit].cx}
          cy={GLOWS[lit].cy}
          rx={GLOWS[lit].rx}
          ry={GLOWS[lit].ry}
          fill="url(#glowGrad)"
          stroke={K.cream}
          strokeWidth="2.5"
          strokeDasharray="8 6"
        />
      )}

      {/* ================= 引线标注 ================= */}
      {CALLOUTS.map((c) => (
        <g
          key={c.part}
          className={"callout-svg" + (activePart === c.part ? " active" : "") + (activePart && activePart !== c.part ? " dim" : "")}
          onClick={() => onPartClick(c.part)}
          onMouseEnter={() => onPartHover(c.part)}
          onMouseLeave={() => onPartHover(null)}
        >
          {/* 透明粗命中线：引线本体太细，扩大可点区域 */}
          <line
            x1={c.dot[0]} y1={c.dot[1]} x2={c.end[0]} y2={c.end[1]}
            stroke="transparent" strokeWidth="18" strokeLinecap="round"
          />
          <line
            className="cl-line-svg"
            x1={c.dot[0]} y1={c.dot[1]} x2={c.end[0]} y2={c.end[1]}
            stroke="#b93b28" strokeWidth="1.6"
          />
          <circle className="cl-dot-svg" cx={c.dot[0]} cy={c.dot[1]} r="15"
                  fill="rgba(243,244,241,0.92)" stroke="#b93b28" strokeWidth="2" />
          <text x={c.dot[0]} y={c.dot[1] + 4} textAnchor="middle" fontSize="11"
                fontFamily="ui-monospace, monospace" fill="#b93b28" fontWeight="700">
            {c.no}
          </text>
          <text
            className="cl-label-svg"
            x={c.side === "left" ? c.end[0] - 8 : c.end[0] + 8}
            y={c.end[1] + 4}
            textAnchor={c.side === "left" ? "end" : "start"}
            fontSize="14"
            fontFamily="ui-monospace, monospace"
            fill="#151613"
          >
            <tspan fill="#b93b28" fontWeight="700">{c.no}</tspan>
            {" " + c.label}
          </text>
        </g>
      ))}

      {/* 角标 */}
      <text x="20" y="28" fontSize="11" fontFamily="ui-monospace, monospace" fill="#696b64" letterSpacing="2">
        PAPER CASE MK-I · SIDE VIEW
      </text>
      <text x="840" y="28" textAnchor="end" fontSize="11" fontFamily="ui-monospace, monospace" fill="#b93b28" letterSpacing="2">
        树码空间 · 非官方结构示意
      </text>
    </svg>
  );
}
