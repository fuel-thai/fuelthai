import type { Lang } from "../lib/language-store";
import { useState } from "react";

interface ShareProps {
	url?: string;
	title: string;
	text: string;
	lang: Lang;
}

export function ShareButtons({ url, title, text, lang }: ShareProps) {
	const [copied, setCopied] = useState(false);
	const shareUrl = url || window.location.href;
	const encodedUrl = encodeURIComponent(shareUrl);
	const encodedText = encodeURIComponent(text);

	const lineUrl = `https://social-plugins.line.me/lineit/share?url=${encodedUrl}&text=${encodedText}`;
	const fbUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;

	function copyLink() {
		navigator.clipboard?.writeText(shareUrl).then(() => {
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		});
	}

	function nativeShare() {
		if (navigator.share) {
			navigator.share({ title, text, url: shareUrl }).catch(() => {});
		}
	}

	return (
		<div className="flex flex-wrap gap-2">
			{/* LINE -- #1 priority for Thailand */}
			<a
				href={lineUrl}
				target="_blank"
				rel="noreferrer"
				className="inline-flex items-center gap-1.5 rounded-lg bg-[#06C755]/20 px-3 py-1.5 font-mono text-xs font-bold text-[#06C755] hover:bg-[#06C755]/30 transition-colors"
			>
				LINE
			</a>

			{/* Facebook */}
			<a
				href={fbUrl}
				target="_blank"
				rel="noreferrer"
				className="inline-flex items-center gap-1.5 rounded-lg bg-[#1877F2]/20 px-3 py-1.5 font-mono text-xs font-bold text-[#1877F2] hover:bg-[#1877F2]/30 transition-colors"
			>
				Facebook
			</a>

			{/* Native share (mobile) */}
			{typeof navigator !== "undefined" && "share" in navigator && (
				<button
					type="button"
					onClick={nativeShare}
					className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-3 py-1.5 font-mono text-xs font-bold text-foreground hover:bg-muted/80 transition-colors"
				>
					{lang === "th" ? "แชร์" : "Share"}
				</button>
			)}

			{/* Copy link */}
			<button
				type="button"
				onClick={copyLink}
				className="inline-flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 font-mono text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
			>
				{copied ? (lang === "th" ? "คัดลอกแล้ว!" : "Copied!") : (lang === "th" ? "คัดลอกลิงก์" : "Copy Link")}
			</button>
		</div>
	);
}
