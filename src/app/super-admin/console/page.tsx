import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function SuperAdminConsolePage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  if (resolved?.tab) {
    redirect(`/super-admin?tab=${encodeURIComponent(resolved.tab)}`);
  }
  redirect("/super-admin");
}
