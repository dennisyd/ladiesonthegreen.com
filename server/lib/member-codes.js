import crypto from "node:crypto";
import path from "node:path";
import { jsonStore } from "./store.js";
import { safeEqual } from "./auth.js";

const CODE_LIFETIME_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;

export function createMemberCodes(dataDir, digest, now = Date.now) {
  const store = jsonStore(path.join(dataDir, "signin-codes.json"), { codes: [] });

  return {
    async issue(memberId) {
      const id = crypto.randomUUID();
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
      await store.update((data) => {
        // A resend invalidates earlier codes, including codes from other devices.
        data.codes = data.codes.filter((c) => c.expiresAt > now() && c.memberId !== memberId);
        data.codes.push({ id, memberId, hash: digest(`${id}:${code}`), expiresAt: now() + CODE_LIFETIME_MS, attempts: 0 });
      });
      return { id, code };
    },
    async revoke(id) {
      await store.update((data) => { data.codes = data.codes.filter((c) => c.id !== id); });
    },
    async consume(id, code) {
      // Check and remove under the store's write lock so concurrent requests
      // cannot use the same successful code twice.
      return store.update((data) => {
        data.codes = data.codes.filter((c) => c.expiresAt > now());
        const challenge = data.codes.find((c) => c.id === id);
        if (!challenge) return null;
        challenge.attempts += 1;
        const valid = /^\d{6}$/.test(code) && safeEqual(challenge.hash, digest(`${id}:${code}`));
        if (valid || challenge.attempts >= MAX_ATTEMPTS) {
          data.codes = data.codes.filter((c) => c.id !== id);
        }
        return valid ? challenge.memberId : null;
      });
    }
  };
}
