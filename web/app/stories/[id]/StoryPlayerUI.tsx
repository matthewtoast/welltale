import { FormEvent } from "react";
import { Col } from "../../components/Col";
import { Row } from "../../components/Row";

type Props = {
  title: string;
  currentText: string;
  currentSpeaker: string;
  phase: "idle" | "running" | "waiting" | "finished" | "error";
  input: string;
  error: string | null;
  isInputActive: boolean;
  canPlay: boolean;
  onPlayClick: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export function StoryPlayerUI({
  title,
  currentText,
  currentSpeaker,
  phase,
  input,
  error,
  isInputActive,
  canPlay,
  onPlayClick,
  onInputChange,
  onSubmit,
}: Props) {
  return (
    <>
      <style jsx global>{`
        .story-player {
          height: 100%;
          margin: 0;
          padding: 0;
          font-family: var(--font-sans);
          background-color: #000;
          color: #fff;
        }
      `}</style>
      <Col className="story-player">
        <Row>{title}</Row>
      </Col>
    </>
  );
}

// <Col className="story-player h-screen w-full bg-black text-white overflow-hidden">
//   <View className="p-3 text-center">
//     <h1 className="text-sm font-medium text-stone-500 uppercase tracking-wide">
//       {title}
//     </h1>
//   </View>

//   <Col expand className="story-center px-6 py-4">
//     <View className="w-full max-w-2xl">
//       {currentSpeaker && (
//         <View className="text-xs font-semibold text-emerald-400 mb-3 uppercase tracking-[0.2em]">
//           {currentSpeaker}
//         </View>
//       )}
//       <View className="text-2xl md:text-3xl font-light leading-snug">
//         {currentText || (phase === "idle" ? "Press play to begin" : "")}
//       </View>
//       {error && (
//         <View className="mt-6 text-rose-400 text-sm">{error}</View>
//       )}
//     </View>
//   </Col>

//   <View className="pb-safe">
//     <View className="px-5 pb-5">
//       <Col gap={16} className="story-controls">
//         <button
//           onClick={onPlayClick}
//           disabled={phase === "running" || !canPlay}
//           className="play-button"
//           type="button"
//         >
//           <PlayIcon style={{ width: "28px", height: "28px" }} />
//         </button>

//         <form onSubmit={onSubmit} className="w-full">
//           <input
//             type="text"
//             value={input}
//             onChange={(e) => onInputChange(e.target.value)}
//             disabled={!isInputActive}
//             className="story-input"
//             placeholder={isInputActive ? "Type your response..." : ""}
//             autoFocus={isInputActive}
//           />
//         </form>
//       </Col>
//     </View>
//   </View>
// </Col>
