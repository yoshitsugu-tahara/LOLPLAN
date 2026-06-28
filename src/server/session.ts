import { auth } from "@/auth";

/** ログイン中ユーザーのID。未ログインなら例外。 */
export async function getUserId(): Promise<string> {
  const session = await auth();
  const id = session?.user?.id;
  if (!id) throw new Error("UNAUTHENTICATED");
  return id;
}
