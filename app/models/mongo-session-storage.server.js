import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";

// @shopify/shopify-app-session-storage-prisma always includes `id` in the
// `update` clause of its upsert() call. That's harmless for SQL databases,
// but Prisma's MongoDB connector rejects writing to the `_id`-mapped field
// via `update` at all ("Unknown argument `id`"). This subclass fixes just
// that one call - loadSession, deleteSession, and row<->Session translation
// are all inherited unchanged from the tested upstream package.
export class MongoSessionStorage extends PrismaSessionStorage {
  async storeSession(session) {
    await this.ensureReady();
    const data = this.sessionToRow(session);
    const { id, ...update } = data;

    await this.getSessionTable().upsert({
      where: { id: session.id },
      update,
      create: data,
    });

    return true;
  }
}
