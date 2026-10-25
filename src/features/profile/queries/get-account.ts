import { db } from "@/lib/db";

export function getAccount(userId: string) {
  return db.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, username: true, bio: true, image: true, passwordHash: true },
  });
}
