import fs from "node:fs/promises";
import path from "node:path";

// A JSON file with an in-memory copy. Writes run one at a time and land via a
// temp file + rename, so a crash mid-write never leaves a half-written file.
// A file that exists but cannot be parsed is an error, never silently reset.
export function jsonStore(file, fallback) {
  let cache = null;
  let queue = Promise.resolve();

  async function load() {
    if (cache) return cache;
    try {
      cache = JSON.parse(await fs.readFile(file, "utf8"));
    } catch (error) {
      if (error.code !== "ENOENT") {
        throw new Error(`Could not read ${path.basename(file)}: ${error.message}`);
      }
      cache = structuredClone(fallback);
    }
    return cache;
  }

  async function save() {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const tmp = `${file}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(cache, null, 2));
    await fs.rename(tmp, file);
  }

  return {
    // Returns a deep copy so callers cannot mutate stored data by accident.
    async read() {
      await queue;
      return structuredClone(await load());
    },
    // fn receives the live data to mutate; its return value is passed through.
    update(fn) {
      const run = queue.then(async () => {
        const data = await load();
        try {
          const result = await fn(data);
          await save();
          return result;
        } catch (error) {
          cache = null; // drop half-applied changes; next access re-reads the file
          throw error;
        }
      });
      queue = run.catch(() => {});
      return run;
    }
  };
}
