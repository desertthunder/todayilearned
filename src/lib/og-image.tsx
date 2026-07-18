import { readFile } from "node:fs/promises";
import { ImageResponse } from "takumi-js/response";
import { META } from "./meta";

const colors = {
	background: "#16181a",
	surface: "#1e2124",
	raised: "#2b3036",
	border: "#3c4048",
	muted: "#9ba5b7",
	text: "#ffffff",
	cyan: "#5ef1ff",
	magenta: "#ff5ef1",
	green: "#5eff6c",
};

const projectRoot = new URL(`file://${process.cwd()}/`);
const sansFontUrl = new URL(
	"node_modules/@fontsource-variable/ibm-plex-sans/files/ibm-plex-sans-latin-wght-normal.woff2",
	projectRoot,
);
const serifFontUrl = new URL(
	"node_modules/@fontsource/ibm-plex-serif/files/ibm-plex-serif-latin-500-normal.woff2",
	projectRoot,
);
const monoFontUrl = new URL(
	"node_modules/@fontsource-variable/google-sans-code/files/google-sans-code-latin-wght-normal.woff2",
	projectRoot,
);

const fonts = Promise.all([
	readFile(sansFontUrl).then((data) => ({ name: "IBM Plex Sans", data, weight: 400, style: "normal" as const })),
	readFile(serifFontUrl).then((data) => ({ name: "IBM Plex Serif", data, weight: 500, style: "normal" as const })),
	readFile(monoFontUrl).then((data) => ({ name: "Google Sans Code", data, weight: 400, style: "normal" as const })),
]);

export async function generateOGImage() {
	return new ImageResponse(
		(
			<div
				style={{
					width: "100%",
					height: "100%",
					display: "flex",
					position: "relative",
					overflow: "hidden",
					backgroundColor: colors.background,
					color: colors.text,
					fontFamily: '"IBM Plex Sans", sans-serif',
				}}>
				<div style={{ position: "absolute", inset: 0, opacity: 0.32 }} />
				<div
					style={{
						position: "absolute",
						top: "-180px",
						right: "-120px",
						width: "520px",
						height: "520px",
						borderRadius: "50%",
						background: `radial-gradient(circle, ${colors.cyan}2e 0%, transparent 68%)`,
					}}
				/>
				<div
					style={{
						position: "relative",
						display: "flex",
						flexDirection: "column",
						flex: 1,
						margin: "48px",
						border: `1px solid ${colors.border}`,
						borderRadius: "14px",
						overflow: "hidden",
						backgroundColor: colors.surface,
						boxShadow: `0 28px 80px rgba(0, 0, 0, 0.38), 0 0 0 1px ${colors.cyan}1a`,
					}}>
					<div
						style={{
							display: "flex",
							alignItems: "center",
							justifyContent: "space-between",
							height: "64px",
							padding: "0 24px",
							borderBottom: `1px solid ${colors.border}`,
							backgroundColor: colors.raised,
							fontFamily: '"Google Sans Code", monospace',
							fontSize: "18px",
						}}>
						<div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
							<div style={{ display: "flex", gap: "8px" }}>
								<div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: colors.magenta }} />
								<div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: colors.cyan }} />
								<div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: colors.green }} />
							</div>
							<div style={{ width: "1px", height: "18px", backgroundColor: colors.border }} />
							<span>til.desertthunder.dev</span>
						</div>
						<span style={{ color: colors.muted }}>{META.REPO_URL.replace(/^https?\:\/\//i, "")}</span>
					</div>

					<div style={{ display: "flex", flex: 1 }}>
						<div
							style={{
								display: "flex",
								flexDirection: "column",
								justifyContent: "space-between",
								width: "292px",
								padding: "40px",
								borderRight: `1px solid ${colors.border}`,
								backgroundColor: colors.background,
							}}>
							<div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
								<p style={{ margin: 0, color: colors.muted, fontSize: "22px", lineHeight: 1.45 }}>{META.DESCRIPTION}</p>
							</div>
							<div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
								<div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: colors.cyan }} />
								<div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: colors.magenta }} />
								<span
									style={{
										marginLeft: "4px",
										color: colors.muted,
										fontFamily: '"Google Sans Code", monospace',
										fontSize: "16px",
									}}>
									CYBERDREAM
								</span>
							</div>
						</div>

						<div style={{ display: "flex", flex: 1, flexDirection: "column", padding: "48px" }}>
							<span
								style={{
									marginBottom: "24px",
									color: colors.magenta,
									fontFamily: '"Google Sans Code", monospace',
									fontSize: "18px",
									letterSpacing: "0.125em",
								}}>
								{META.NAME.toUpperCase()}
							</span>
							<h1
								style={{
									display: "flex",
									flexDirection: "column",
									margin: 0,
									fontFamily: '"IBM Plex Serif", serif',
									fontSize: "84px",
									fontWeight: 500,
									letterSpacing: "-0.025em",
									lineHeight: 1,
								}}>
								<span>Today I</span>
								<span style={{ color: colors.cyan }}>Learned</span>
							</h1>
						</div>
					</div>
				</div>
			</div>
		),
		{ width: 1200, height: 630, format: "png", fonts: await fonts },
	);
}
