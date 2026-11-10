"use client";

/**
 * Last resort: a failure in the root layout itself, where no styles or providers are available.
 * It has to render its own <html> and <body>, so everything here is inline.
 */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", background: "#0b0b0d", color: "#ece8df", fontFamily: "system-ui, -apple-system, sans-serif", padding: "0 20px" }}>
        <div style={{ maxWidth: 380, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, fontWeight: 500, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ fontSize: 14, lineHeight: 1.6, color: "#a19b8f", margin: "0 0 24px" }}>
            Renaissance Commerce couldn&apos;t load. Please try again in a moment.
          </p>
          <button onClick={reset} style={{ padding: "10px 20px", borderRadius: 8, background: "#c9a961", color: "#0b0b0d", border: 0, fontWeight: 500, fontSize: 14, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
