import { headers } from "next/headers";
import { StoryMeta, StorySource } from "../../../../lib/engine/StoryTypes";
import { StoryPlayer } from "./StoryPlayer";

type StoryPageProps = {
  params: Promise<{ id: string }>;
};

type StoryRes = {
  meta: StoryMeta | null;
  source: StorySource | null;
};

async function fetchStoryData(
  id: string
): Promise<{ meta: StoryMeta | null; source: StorySource | null }> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  if (!host) return { meta: null, source: null };
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/api/stories/${id}`;
  const res = await fetch(url, {
    headers: { cookie: hdrs.get("cookie") ?? "" },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return { meta: null, source: null };
  if (!res.ok) return { meta: null, source: null };
  const data = (await res.json().catch(() => null)) as StoryRes | null;
  if (!data) return { meta: null, source: null };
  return { meta: data.meta, source: data.source };
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { id } = await params;
  const { meta, source } = await fetchStoryData(id);
  if (meta && source) {
    return <StoryPlayer meta={meta} source={source} />;
  }
  return <></>;
}
