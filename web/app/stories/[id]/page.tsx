import { headers } from "next/headers";
import { StoryMeta } from "../../../../lib/StoryTypes";
import { StoryPlayer } from "./StoryPlayer";

type StoryPageProps = {
  params: Promise<{ id: string }>;
};

type MetaRes = {
  meta: StoryMeta | null;
};

async function fetchStoryMeta(id: string): Promise<StoryMeta | null> {
  const hdrs = await headers();
  const host = hdrs.get("x-forwarded-host") ?? hdrs.get("host");
  if (!host) return null;
  const proto = hdrs.get("x-forwarded-proto") ?? "http";
  const url = `${proto}://${host}/api/stories/${id}`;
  const res = await fetch(url, {
    headers: { cookie: hdrs.get("cookie") ?? "" },
    cache: "no-store",
  }).catch(() => null);
  if (!res) return null;
  if (!res.ok) return null;
  const data = (await res.json().catch(() => null)) as MetaRes | null;
  if (!data) return null;
  if (!data.meta) return null;
  return data.meta;
}

export default async function StoryPage({ params }: StoryPageProps) {
  const { id } = await params;
  const meta = await fetchStoryMeta(id);
  if (meta) {
    return <StoryPlayer {...meta} />;
  }
  return <></>;
}
