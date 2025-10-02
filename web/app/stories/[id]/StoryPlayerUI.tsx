import {
  faArrowLeft,
  faBackwardStep,
  faCog,
  faForwardStep,
  faPaperPlane,
  faPause,
  faPlay,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { FormEvent, useEffect, useRef } from "react";
import { textWithBracketsToSpans } from "../../../../lib/ReactHelpers";
import { HOST_ID } from "../../../../lib/StoryConstants";
import { StoryMeta } from "../../../../lib/StoryTypes";
import { strToDeterministicRgba } from "../../../../lib/StyleHelpers";
import { colors } from "../../../lib/colors";
import { Col } from "../../components/Col";
import { Row } from "../../components/Row";
import { View } from "../../components/View";

type Props = {
  title: string;
  currentText: string;
  currentSpeaker: string;
  phase: "idle" | "running" | "waiting" | "finished" | "error" | "paused";
  input: string;
  error: string | null;
  isInputActive: boolean;
  canPlay: boolean;
  canGoNext: boolean;
  canGoPrev: boolean;
  onPlayClick: () => void;
  onPauseClick: () => void;
  onBackClick: () => void;
  onSettingsClick: () => void;
  onPrevClick: () => void;
  onNextClick: () => void;
  onInputChange: (value: string) => void;
  onSubmit: (e: FormEvent) => void;
};

export function StoryPlayerUI({
  title,
  author,
  currentText,
  currentSpeaker,
  phase,
  input,
  error,
  isInputActive,
  canPlay,
  canGoNext,
  canGoPrev,
  onPlayClick,
  onPauseClick,
  onBackClick,
  onSettingsClick,
  onPrevClick,
  onNextClick,
  onInputChange,
  onSubmit,
}: Props & StoryMeta) {
  const playing = phase === "running";
  const displayText =
    currentText || (phase === "idle" ? "Press play to begin" : "");
  const playDisabled = playing ? false : !canPlay;
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "40px";
      const scrollHeight = textareaRef.current.scrollHeight;
      textareaRef.current.style.height = `${Math.max(40, scrollHeight)}px`;
    }
  }, [input]);

  return (
    <>
      <style jsx global>{`
        .story-player {
          height: 100%;
          min-height: 100vh;
          margin: 0;
          padding: 0;
          font-family: var(--font-sans);
          background-color: ${colors.BLACK};
          color: ${colors.WHITE};
          flex: 1;
        }
      `}</style>
      <Col className="story-player" expand>
        <Row style={{ padding: "20px 24px" }}>
          <button
            type="button"
            onClick={onBackClick}
            style={{
              background: "transparent",
              border: "none",
            }}
            aria-label="Back"
          >
            <FontAwesomeIcon
              icon={faArrowLeft}
              style={{ color: colors.GRAY_DARK, width: 20, height: 20 }}
            />
          </button>
          <View expand></View>
          <Col
            style={{
              padding: "0 24px",
              textAlign: "center",
              fontFamily: "Helvetica, Arial, sans-serif",
            }}
          >
            <View
              style={{
                fontSize: "14px",
                fontWeight: "bold",
                color: colors.GRAY_DARK,
              }}
            >
              {title || "untitled"}
            </View>
            <View style={{ fontSize: "12px", color: colors.GRAY_DARK }}>
              {author || "anonymous"}
            </View>
          </Col>
          <View expand></View>
          <button
            type="button"
            onClick={onSettingsClick}
            style={{
              display: "flex",
              height: "30px",
              width: "30px",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "none",
            }}
            aria-label="Settings"
          >
            <FontAwesomeIcon
              icon={faCog}
              style={{ color: colors.GRAY_DARK, width: 20, height: 20 }}
            />
          </button>
        </Row>
        <Row expand></Row>
        <Col
          style={{
            margin: 12,
            height: 200,
            overflow: "scroll",
            fontSize: "16px",
            padding: 12,
            borderRadius: 12,
            backgroundColor: colors.BLACK_WELL,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textAlign: "center",
          }}
        >
          {currentSpeaker && (
            <span
              style={{
                fontWeight: "bold",
                color:
                  currentSpeaker === HOST_ID
                    ? "cyan"
                    : currentSpeaker === "YOU"
                      ? "lime"
                      : strToDeterministicRgba(currentSpeaker, 1),
                marginBottom: 6,
              }}
            >
              {currentSpeaker}
            </span>
          )}
          <span style={{ lineHeight: 1.35 }}>
            {textWithBracketsToSpans(
              currentText,
              {},
              { color: colors.GRAY_LIGHT, fontStyle: "italic" }
            )}
          </span>
        </Col>
        <Row
          style={{
            gap: 10,
            // justifyContent: "center",
            padding: "24px 24px",
            display: "flex",
            alignItems: "center",
          }}
        >
          <View expand></View>
          <button
            onClick={onPrevClick}
            disabled={!canGoPrev}
            style={{
              display: "flex",
              height: "48px",
              width: "48px",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "none",
            }}
            aria-label="Previous"
          >
            <FontAwesomeIcon
              icon={faBackwardStep}
              style={{
                color: canGoPrev ? colors.WHITE : colors.GRAY_DARK,
                width: 24,
                height: 24,
              }}
            />
          </button>
          <button
            onClick={playing ? onPauseClick : onPlayClick}
            disabled={playDisabled}
            style={{
              display: "flex",
              height: "64px",
              width: "64px",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              lineHeight: 1,
              padding: 0,
              margin: 0,
              backgroundColor: playDisabled ? colors.GRAY_DARK : colors.WHITE,
              border: "none",
            }}
            aria-label={playing ? "Pause" : "Play"}
          >
            {playing ? (
              <FontAwesomeIcon
                icon={faPause}
                style={{ color: colors.BLACK, width: 32, height: 32 }}
              />
            ) : (
              <FontAwesomeIcon
                icon={faPlay}
                style={{ color: colors.BLACK, width: 32, height: 32 }}
              />
            )}
          </button>
          <button
            onClick={onNextClick}
            disabled={!canGoNext}
            style={{
              display: "flex",
              height: "48px",
              width: "48px",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: "50%",
              border: "none",
            }}
            aria-label="Next"
          >
            <FontAwesomeIcon
              icon={faForwardStep}
              style={{
                color: canGoNext ? colors.WHITE : colors.GRAY_DARK,
                width: 24,
                height: 24,
              }}
            />
          </button>
          <View expand></View>
        </Row>
        <Row expand></Row>
        <View
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            padding: "12px",
            backgroundColor: colors.BLACK,
          }}
        >
          <form
            onSubmit={onSubmit}
            style={{ position: "relative", width: "100%" }}
          >
            <textarea
              ref={textareaRef}
              value={input ?? ""}
              onChange={(e) => onInputChange(e.target.value)}
              disabled={!isInputActive}
              spellCheck={false}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  onSubmit(e as any);
                }
              }}
              style={{
                width: "100%",
                minHeight: "40px",
                maxHeight: "120px",
                borderRadius: "20px",
                border: "none",
                backgroundColor: colors.GRAY_NIGHT,
                padding: "10px 14px",
                paddingRight: input && isInputActive ? "46px" : "14px",
                fontSize: "14px",
                outline: "none",
                color: isInputActive ? colors.WHITE : colors.GRAY_LIGHT,
                opacity: !isInputActive ? 0.5 : 1,
                resize: "none",
                overflow: "auto",
                fontFamily: "inherit",
                lineHeight: 1.4,
              }}
              placeholder={isInputActive ? "Enter text" : "Please wait"}
              autoFocus={isInputActive}
            />
            {input && isInputActive && (
              <button
                type="submit"
                style={{
                  position: "absolute",
                  right: 10,
                  bottom: 12,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  width: 26,
                  height: 26,
                  borderRadius: "50%",
                  paddingTop: 2,
                  paddingRight: 8,
                  border: "none",
                  backgroundColor: colors.WHITE,
                  cursor: "pointer",
                }}
                aria-label="Send"
              >
                <FontAwesomeIcon
                  icon={faPaperPlane}
                  style={{ color: colors.BLACK, width: 14, height: 14 }}
                />
              </button>
            )}
          </form>
        </View>
      </Col>
    </>
  );
}
