// Main-thread wrapper around src/workers/parser.worker.js.
//
// One worker instance is reused for the life of the page (creation is
// non-trivial: bundle load + module init). The wrapper assigns each call a
// monotonic id so concurrent parses (rare but possible if a user mass-uploads)
// don't conflate replies. Promise resolution is keyed on id.
//
// Failure modes the caller should know about:
//   - Worker creation throws if the browser blocks workers (some restrictive
//     CSPs do). The wrapper rethrows synchronously from parseInWorker so the
//     caller's catch block sees a normal Error before the parse promise is
//     awaited.
//   - Worker termination (e.g., the browser kills the worker after long
//     inactivity) leaves pending promises hanging. We don't currently detect
//     this; if it becomes a real problem, add an `onerror` handler that
//     rejects all pending entries with a "worker died" error.

let workerInstance = null;
let nextId = 0;
const pending = new Map();

function getWorker() {
  if (workerInstance) return workerInstance;

  workerInstance = new Worker(
    new URL("../workers/parser.worker.js", import.meta.url),
    { type: "module" },
  );

  workerInstance.onmessage = (e) => {
    const { id, sections, error } = e.data || {};
    const entry = pending.get(id);
    if (!entry) return; // late reply for a discarded promise
    pending.delete(id);
    if (error) entry.reject(new Error(error));
    else entry.resolve(sections);
  };

  // Catch-all: malformed messages, unhandled rejections inside the worker
  // module, etc. Reject *all* pending entries so the user sees a parse
  // failure instead of a loader stuck forever.
  workerInstance.onerror = (e) => {
    const msg = e?.message || "Parser worker crashed";
    for (const entry of pending.values()) entry.reject(new Error(msg));
    pending.clear();
  };

  return workerInstance;
}

export function parseInWorker(type, payload) {
  const id = ++nextId;
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject });
    try {
      getWorker().postMessage({ id, type, payload });
    } catch (err) {
      pending.delete(id);
      reject(err);
    }
  });
}
