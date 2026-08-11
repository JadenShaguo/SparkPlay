"use client";

import { Copy, Flag, GitFork } from "lucide-react";
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
  const [reportMessage, setReportMessage] = useState("");
  const [reporting, setReporting] = useState(false);
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

  async function reportPlayable() {
    const reason = window.prompt("请简单说明举报原因，例如：不适宜内容、侵权、欺诈或其他风险");
    if (!reason?.trim()) return;
    setReporting(true);
    setReportMessage("");
    try {
      const response = await fetch(`/api/share-links/${slug}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "举报失败");
      setReportMessage("已收到举报，我们会在审核后处理。");
    } catch (error) {
      setReportMessage(error instanceof Error ? error.message : "举报失败");
    } finally {
      setReporting(false);
    }
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
              {authenticated ? "Remix" : "游客 Remix"}
            </button>
          </form>
          <button className="icon-button with-label" type="button" onClick={copyCurrentUrl}>
            <Copy size={18} />
            {copied ? "已复制" : "分享"}
          </button>
          <button className="icon-button with-label" type="button" disabled={reporting} onClick={reportPlayable}>
            <Flag size={18} />
            举报
          </button>
        </div>
      </div>
      {reportMessage && <div className="play-notice">{reportMessage}</div>}
      <div className="play-frame-wrap" onPointerDownCapture={recordPlayStart} onFocusCapture={recordPlayStart}>
        <iframe title={title} srcDoc={html} sandbox="allow-scripts" referrerPolicy="no-referrer" />
      </div>
    </>
  );
}
