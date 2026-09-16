/**
 * Reads the latest GitHub release once at build time and maps its assets to
 * the platforms Slot2Sync ships for. Filenames carry the version
 * (`Slot2Sync_0.16.0_x64-setup.exe`), so a fixed URL would go stale on every
 * release. Reading it at build time keeps every download button pointed at
 * the real, current file without a runtime API call.
 */

const REPO = "jIDvDIj/slot2sync";
export const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

export type PlatformId = "windows" | "macArm" | "macIntel" | "linux";

export interface PlatformAsset {
  id: PlatformId;
  os: "windows" | "apple" | "linux";
  label: string;
  formatLabel: string;
  url: string;
  sizeMb: string | null;
  alternates: { label: string; url: string }[];
}

interface RawAsset {
  name: string;
  url: string;
  sizeMb: string;
}

async function fetchLatestRelease(): Promise<{ version: string; assets: RawAsset[] } | null> {
  try {
    const response = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const assets: RawAsset[] = (data.assets ?? [])
      .filter((a: { name: string }) => !a.name.endsWith(".sig") && a.name !== "latest.json")
      .map((a: { name: string; browser_download_url: string; size: number }) => ({
        name: a.name,
        url: a.browser_download_url,
        sizeMb: (a.size / 1_000_000).toFixed(1),
      }));
    return { version: (data.tag_name as string).replace(/^app-v/, ""), assets };
  } catch {
    return null;
  }
}

function find(assets: RawAsset[], suffix: string): RawAsset | undefined {
  return assets.find((a) => a.name.endsWith(suffix));
}

function asset(found: RawAsset | undefined): { url: string; sizeMb: string | null } {
  return found ? { url: found.url, sizeMb: found.sizeMb } : { url: RELEASES_PAGE, sizeMb: null };
}

export interface ReleaseData {
  version: string | null;
  platforms: Record<PlatformId, PlatformAsset>;
}

export async function loadRelease(): Promise<ReleaseData> {
  const release = await fetchLatestRelease();
  const assets = release?.assets ?? [];

  const exe = asset(find(assets, "-setup.exe"));
  const msi = asset(find(assets, ".msi"));
  const macArm = asset(find(assets, "aarch64.dmg"));
  const macIntel = asset(find(assets, "_x64.dmg"));
  const appImage = asset(find(assets, ".AppImage"));
  const deb = asset(find(assets, "amd64.deb"));
  const rpm = asset(find(assets, ".x86_64.rpm"));

  return {
    version: release?.version ?? null,
    platforms: {
      windows: {
        id: "windows",
        os: "windows",
        label: "Windows",
        formatLabel: "Instalador (.exe)",
        ...exe,
        alternates: [{ label: ".msi", url: msi.url }],
      },
      macArm: {
        id: "macArm",
        os: "apple",
        label: "macOS (Apple Silicon)",
        formatLabel: "Apple Silicon (.dmg)",
        ...macArm,
        alternates: [{ label: "Mac Intel", url: macIntel.url }],
      },
      macIntel: {
        id: "macIntel",
        os: "apple",
        label: "macOS (Intel)",
        formatLabel: "Intel (.dmg)",
        ...macIntel,
        alternates: [{ label: "Apple Silicon", url: macArm.url }],
      },
      linux: {
        id: "linux",
        os: "linux",
        label: "Linux",
        formatLabel: "AppImage",
        ...appImage,
        alternates: [
          { label: ".deb", url: deb.url },
          { label: ".rpm", url: rpm.url },
        ],
      },
    },
  };
}
