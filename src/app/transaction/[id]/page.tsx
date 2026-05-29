import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TransactionDetailClient } from "./TransactionDetailClient";

export default async function TransactionPage({
  params,
}: {
  params: { id: string };
}) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/");
  }

  // The redesigned transaction screens own their chrome (in-screen .tx-topbar),
  // so the global öz app header is intentionally omitted on this route.
  return (
    <main className="min-h-[100dvh] flex flex-col bg-bg">
      <TransactionDetailClient id={params.id} currentUserId={user.id} />
    </main>
  );
}
