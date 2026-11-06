"use client";

import { useEffect } from "react";

/** Adds a Copy button to every prompt block (`.kb-prompt`) in the lesson HTML. */
export function PromptCopy({ lessonId }: { lessonId: string }) {
  useEffect(() => {
    const blocks = document.querySelectorAll<HTMLElement>(".kb-prompt");
    const added: HTMLButtonElement[] = [];
    blocks.forEach((b) => {
      const head = b.querySelector(".kb-prompt-head");
      const text = b.querySelector(".kb-prompt-text");
      if (!head || !text || head.querySelector("button")) return;
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "kb-prompt-copy";
      btn.textContent = "Copy prompt";
      btn.onclick = async () => {
        try {
          await navigator.clipboard.writeText(text.textContent ?? "");
          btn.textContent = "Copied";
        } catch {
          btn.textContent = "Select and copy";
        }
        setTimeout(() => (btn.textContent = "Copy prompt"), 1800);
      };
      head.appendChild(btn);
      added.push(btn);
    });
    return () => added.forEach((b) => b.remove());
  }, [lessonId]);
  return null;
}
