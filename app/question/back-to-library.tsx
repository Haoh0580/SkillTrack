"use client";

export function BackToLibrary() {
  return <button type="button" onClick={() => window.location.assign("/training")} style={{ padding: 0, marginBottom: 28, background: "transparent", color: "#265ca9", fontWeight: "bold" }}>← 回到題庫</button>;
}
