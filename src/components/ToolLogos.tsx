import type { ComponentType } from "react";

type ToolGlyphProps = { className?: string };

type Tool = { name: string; Glyph: ComponentType<ToolGlyphProps> };

function GeminiGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="gmin" x1="0" y1="0" x2="1" y2="1">
          <stop stopColor="#4285F4" />
          <stop offset="0.5" stopColor="#9B72CB" />
          <stop offset="1" stopColor="#EA4335" />
        </linearGradient>
      </defs>
      <path
        fill="url(#gmin)"
        d="M12 1.6c1.2 5.1 3.9 7.8 10 8.7-6.1.9-8.8 3.6-10 8.7-1.2-5.1-3.9-7.8-10-8.7 6.1-.9 8.8-3.6 10-8.7Z"
      />
    </svg>
  );
}

function ClaudeGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        d="M12 3.6v16.8M4.3 8.4v7.2M19.7 8.4v7.2"
        stroke="#C15F3C"
        strokeWidth="3.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function ChatGptGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#10A37F"
        d="M12 2c-2.4 0-4.5 1-5.9 2.7-.3.1-.6.2-.9.4C4.2 6.1 3.4 8 3.4 10c0 1.5.6 2.9 1.6 3.9 0 .4.1.8.1 1.1 0 4 3.1 7.6 7 7.6 2.4 0 4.5-1 5.9-2.7.3-.1.6-.2.9-.4 1.9-1 2.7-2.9 2.7-4.9 0-1.5-.6-2.9-1.6-3.9 0-.4-.1-.8-.1-1.1 0-4-3.1-7.6-7-7.6Z"
      />
      <path
        fill="#fff"
        d="M12 5.6a6.4 6.4 0 0 1 6.4 6.4A6.4 6.4 0 0 1 12 18.4 6.4 6.4 0 0 1 5.6 12 6.4 6.4 0 0 1 12 5.6Z"
      />
      <path
        fill="#10A37F"
        d="M12 8.4A3.6 3.6 0 0 1 15.6 12 3.6 3.6 0 0 1 12 15.6 3.6 3.6 0 0 1 8.4 12 3.6 3.6 0 0 1 12 8.4Z"
      />
    </svg>
  );
}

function KimiGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g
        fill="none"
        stroke="#FF5A1F"
        strokeWidth="3.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M6.5 4v16" />
        <path d="M10.5 8.5 18 4l-6.5 8 6.5 8-7.5-4.5" />
      </g>
    </svg>
  );
}

function OpenCodeGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="opnc" x1="0" y1="1" x2="1" y2="0">
          <stop stopColor="#A78BFA" />
          <stop offset="1" stopColor="#60A5FA" />
        </linearGradient>
      </defs>
      <g
        fill="none"
        stroke="url(#opnc)"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 6.5 8.5 11l-4.5 4.5" />
        <path d="M12 17h8" />
      </g>
    </svg>
  );
}

function VsCodeGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path
        fill="#007ACC"
        d="M16.3 2H6.5A2.5 2.5 0 0 0 4 4.5v15A2.5 2.5 0 0 0 6.5 22h9.8l3.7-3.4c.6-.6 1-1.4 1-2.3V7.7c0-.9-.4-1.7-1-2.3L16.3 2Z"
      />
      <path
        d="m9.5 8 4 4-4 4"
        fill="none"
        stroke="#fff"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function AntigravityGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <g
        fill="none"
        stroke="#475467"
        strokeWidth="2.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="m11.4 4.5-8.5 15h17.2z" />
        <path d="M8 13.5h8" />
      </g>
    </svg>
  );
}

function CursorGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="crs" x1="0" y1="1" x2="1" y2="0">
          <stop stopColor="#2563EB" />
          <stop offset="1" stopColor="#7C3AED" />
        </linearGradient>
      </defs>
      <path
        fill="url(#crs)"
        d="M12 2a10 10 0 1 1-10 10 3 3 0 0 1 6 0 4 4 0 1 0 4-4V2Z"
        fillRule="evenodd"
      />
    </svg>
  );
}

function SublimeGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      <path d="M12 2.6 6.2 8.4 12 14.2l5.8-5.8Z" fill="#F5A62399" />
      <path d="M12 9.8 6.2 15.6 12 21.4l5.8-5.8Z" fill="#E8890C" />
    </svg>
  );
}

function LovableGlyph({ className }: ToolGlyphProps) {
  return (
    <svg viewBox="0 0 121 122" className={className} aria-hidden="true">
      <defs>
        <linearGradient id="love" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0.025" stopColor="#FF8E63" />
          <stop offset="0.56" stopColor="#FF7EB0" />
          <stop offset="0.95" stopColor="#4B73FF" />
        </linearGradient>
      </defs>
      <path
        fill="url(#love)"
        fillRule="evenodd"
        d="M36.069 0c19.92 0 36.068 16.155 36.068 36.084v13.713h12.004c19.92 0 36.069 16.156 36.069 36.084 0 19.928-16.149 36.083-36.069 36.083H0v-85.88C0 16.155 16.148 0 36.069 0Z"
      />
    </svg>
  );
}

export const IA_TOOLS: Tool[] = [
  { name: "Gemini AI", Glyph: GeminiGlyph },
  { name: "Claude AI", Glyph: ClaudeGlyph },
  { name: "ChatGPT AI", Glyph: ChatGptGlyph },
  { name: "Kimi AI", Glyph: KimiGlyph },
  { name: "OpenCode AI", Glyph: OpenCodeGlyph },
  { name: "Lovable", Glyph: LovableGlyph },
];

export const EDITOR_TOOLS: Tool[] = [
  { name: "VS Code", Glyph: VsCodeGlyph },
  { name: "Antigravity", Glyph: AntigravityGlyph },
  { name: "Cursor", Glyph: CursorGlyph },
  { name: "Sublime", Glyph: SublimeGlyph },
];

export function ToolBadges({ tools }: { tools: Tool[] }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {tools.map(({ name, Glyph }) => (
        <span
          key={name}
          className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground"
        >
          <Glyph className="size-4 shrink-0" />
          {name}
        </span>
      ))}
    </div>
  );
}
