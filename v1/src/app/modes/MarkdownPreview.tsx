"use client";

// WHY: The preview is a pure render of the Markdown helper. It owns no state and
// never touches a store, so the write pane and preview cannot drift apart.
// PACK: mode-editor-design
// 2026-11-23 opencode: created for the full-page editor. [pack: mode-editor-design]

import { renderMarkdown } from "./mode-editor-utils";

interface MarkdownPreviewProps {
  source: string;
}

/** Render the approved Markdown subset with HTML already escaped by the helper. */
export default function MarkdownPreview({ source }: MarkdownPreviewProps) {
  return <div className="md-preview" dangerouslySetInnerHTML={{ __html: renderMarkdown(source) }} />;
}
