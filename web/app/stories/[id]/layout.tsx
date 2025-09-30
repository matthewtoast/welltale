import type { ReactNode } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDevSessionToken } from "../../../lib/devSession";

type Props = {
  children: ReactNode;
  params: Promise<{ id: string }>;
};

export default async function StoryLayout({ children, params }: Props) {
  if (process.env.NODE_ENV !== "development") return children;
  const token = getDevSessionToken();
  if (!token) return children;
  const { id } = await params;
  const jar = await cookies();
  const current = jar.get("session");
  if (!current || current.value !== token) {
    const next = `/stories/${id}`;
    redirect(`/dev/session?next=${encodeURIComponent(next)}`);
  }
  return children;
}
