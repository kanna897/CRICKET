import { useEffect, useRef } from "react";
import { useReducerState } from "./state";

export function useCommentaryVoice() {
  const [autoCommentary, setAutoCommentary] = useReducerState(
    () => typeof window !== "undefined" && window.localStorage.getItem("crickpulse:auto-commentary") === "on",
  );
  const [commentaryVoice, setCommentaryVoice] = useReducerState(
    () => typeof window !== "undefined" ? window.localStorage.getItem("crickpulse:commentary-voice") || "en-IN" : "en-IN",
  );
  const lastSpokenCommentary = useRef("");

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  const speakCommentary = (text: string) => {
    if (!autoCommentary || typeof window === "undefined" || !("speechSynthesis" in window)) return;
    if (lastSpokenCommentary.current === text) return;
    lastSpokenCommentary.current = text;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = commentaryVoice;
    utterance.rate = 0.96;
    utterance.pitch = 1;
    const matchingVoice = window.speechSynthesis.getVoices().find((voice) => voice.lang === commentaryVoice)
      || window.speechSynthesis.getVoices().find((voice) => voice.lang.startsWith(commentaryVoice.split("-")[0]));
    if (matchingVoice) utterance.voice = matchingVoice;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  };

  const toggleAutoCommentary = () => {
    if (!("speechSynthesis" in window)) {
      alert("Automated commentary is not supported in this browser. Use Chrome, Edge or Safari.");
      return;
    }
    const enabled = !autoCommentary;
    setAutoCommentary(enabled);
    window.localStorage.setItem("crickpulse:auto-commentary", enabled ? "on" : "off");
    if (!enabled) window.speechSynthesis.cancel();
    else {
      const preview = new SpeechSynthesisUtterance("CrickPulse automated commentary is ready.");
      preview.lang = commentaryVoice;
      window.speechSynthesis.speak(preview);
    }
  };

  const changeCommentaryVoice = (language: string) => {
    setCommentaryVoice(language);
    window.localStorage.setItem("crickpulse:commentary-voice", language);
  };

  return { autoCommentary, commentaryVoice, speakCommentary, toggleAutoCommentary, changeCommentaryVoice };
}
