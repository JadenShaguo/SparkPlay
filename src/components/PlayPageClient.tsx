"use client";

import { Copy, GitFork } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";

interface PlayPageClientProps {
  slug: string;
  title: string;
  html: string;
  thumbnailUrl?: string;
  authorName: string;
  authorUrl: string;
  basedOnTitle?: string;
  basedOnAuthorName?: string;
  basedOnAuthorUrl?: string;
  remixCount: number;
  authenticated: boolean;
}

export function PlayPageClient({
  slug,
  title,
  html,
  thumbnailUrl,
  authorName,
  authorUrl,
  basedOnTitle,
  basedOnAuthorName,
  basedOnAuthorUrl,
  remixCount,
  authenticated
}: PlayPageClientProps) {
  const [copied, setCopied] = useState(false);
  const startedRef = useRef(false);
  const completedRef = useRef(false);

  const recordEvent = useCallback(
    async (type: "playStart" | "playComplete") => {
      await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, type })
      }).catch(() => undefined);
    },
    [slug]
  );

  const recordPlayStart = useCallback(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void recordEvent("playStart");
  }, [recordEvent]);

  const recordPlayComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    void recordEvent("playComplete");
  }, [recordEvent]);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.data?.type === "sparkplay:playStart") recordPlayStart();
      if (event.data?.type === "sparkplay:playComplete") {
        recordPlayStart();
        recordPlayComplete();
      }
    };
    window.addEventListener("message", onMessage);
    return () => window.removeEventListener("message", onMessage);
  }, [recordPlayComplete, recordPlayStart]);

  async function copyCurrentUrl() {
    await navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  }

  return (
    <>
      <div className="play-toolbar">
        <div className="play-title">
          {thumbnailUrl && (
            <span className="play-title-thumb" aria-hidden="true" style={{ backgroundImage: `url(${thumbnailUrl})` }} />
          )}
          <div>
            <p className="eyebrow">SparkPlay</p>
            <h1>{title}</h1>
            <div className="play-byline">
              <Link href={authorUrl}>{authorName}</Link>
              <span>{remixCount} 个 Remix</span>
              {basedOnTitle && (
                <span>
                  基于 {basedOnTitle}
                  {basedOnAuthorName && basedOnAuthorUrl ? (
                    <>
                      {" "}
                      来自 <Link href={basedOnAuthorUrl}>{basedOnAuthorName}</Link>
                    </>
                  ) : null}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="play-actions">
          <form action={`/api/share-links/${slug}/remix`} method="post">
            <button className="icon-button with-label" type="submit">
              <GitFork size={18} />
              {authenticated ? "Remix" : "登录并 Remix"}
            </button>
          </form>
          <button className="icon-button with-label" type="button" onClick={copyCurrentUrl}>
            <Copy size={18} />
            {copied ? "已复制" : "分享"}
          </button>
        </div>
      </div>
      <div className="play-frame-wrap" onPointerDownCapture={recordPlayStart} onFocusCapture={recordPlayStart}>
        <iframe title={title} srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" />
      </div>
    </>
  );
}
