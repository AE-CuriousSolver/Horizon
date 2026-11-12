"use client";

export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-GB">
      <body style={{ fontFamily: "system-ui, sans-serif", textAlign: "center", padding: "6rem 1rem" }}>
        <p>Something went wrong. Please try again in a moment.</p>
        <button type="button" onClick={reset} style={{ marginTop: "1rem" }}>
          Try again
        </button>
      </body>
    </html>
  );
}
