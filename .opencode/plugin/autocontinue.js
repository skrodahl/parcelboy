// autocontinue — keeps the agent working when a turn ends, unless it signalled
// "done" via the safeword. Loaded automatically (auto-discovered from
// .opencode/plugin/). Re-prompt is guarded by a per-session hard cap so it can
// never loop indefinitely.
//
// Behaviour:
//   - On `session.idle` (a turn just ended):
//       * if the last assistant message contains the safeword -> stop (done).
//       * else, if the session is a real interactive one and we're under the cap
//         -> send "Please continue if you're not done." (re-triggers the agent).
//       * else -> stop.
//   - `chat.message`: a *genuine* user message (not our injected continuation)
//     resets the consecutive-continue budget for that session.
//
// Config (via opencode.json `plugin: [["./.opencode/plugin/autocontinue.js", { … }] ]`
// or env vars as a hard off-switch):
//   safeword       default "[pb-done]"     agent outputs this to say "I'm done / waiting"
//   maxContinues   default 25              hard cap on consecutive auto-continues
//   enabled        default true            set false (or OPENCODE_AUTOCONTINUE=0) to disable
//
// NOTE: OpenCode loads plugins at startup — quit + restart for changes to apply.

export default async (input, options = {}) => {
  const { client } = input;
  const enabled = (options.enabled ?? true) && process.env.OPENCODE_AUTOCONTINUE !== "0";
  const SAFEWORD = options.safeword || "[pb-done]";
  const MAX = Math.max(1, options.maxContinues ?? 25);
  const MESSAGE =
    options.message ||
    "Please continue if you're not done. (If you ARE done, or are waiting on me, end your reply with the token `" +
    SAFEWORD +
    "` and the auto-continue hook will stop pinging.)";
  const CONT_MARKER = "Please continue if you're not done"; // our own injected prompts start here

  // per-session consecutive-continue budget + in-flight guard (no per-turn alloc).
  const counters = new Map();
  const inflight = new Set();

  function textOf(parts) {
    return (parts || []).map((p) => (p && p.type === "text" ? p.text : "")).join("\n");
  }
  function lastAssistantText(messages) {
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].info && messages[i].info.role === "assistant") return textOf(messages[i].parts);
    }
    return "";
  }
  function hasUserText(messages) {
    return messages.some((m) => m.info && m.info.role === "user" && textOf(m.parts).trim().length > 0);
  }

  return {
    // One line at startup so you can confirm it loaded (OpenCode loads plugins once, at boot).
    config: async () => {
      console.log(
        "[autocontinue] " +
          (enabled ? "active" : "disabled") +
          " safeword=`" + SAFEWORD + "` maxContinues=" + MAX,
      );
    },

    // A genuine user message gives a fresh budget (our own continuation prompts don't).
    "chat.message": async (inp, out) => {
      if (!enabled) return;
      const sid = inp && inp.sessionID;
      if (!sid) return;
      if (!textOf(out && out.parts).startsWith(CONT_MARKER)) counters.set(sid, 0);
    },

    event: async ({ event }) => {
      if (!enabled) return;
      if (!event || event.type !== "session.idle") return;
      const sid = event.properties && event.properties.sessionID;
      if (!sid) return;
      if (inflight.has(sid)) return; // already re-prompting this session
      inflight.add(sid);
      try {
        const res = await client.session.messages({ path: { id: sid } });
        const messages = (res && res.data) || (Array.isArray(res) ? res : []);
        if (!messages.length || !hasUserText(messages)) return; // not an interactive session
        const lastAssistant = lastAssistantText(messages);
        if (!lastAssistant) return;
        // guardrail 1: the agent signalled it is done / waiting.
        if (lastAssistant.includes(SAFEWORD)) {
          counters.set(sid, 0);
          return;
        }
        // guardrail 2: a hard cap so it can't ping forever.
        const n = counters.get(sid) || 0;
        if (n >= MAX) {
          console.warn("[autocontinue] cap (" + MAX + ") reached for " + sid + "; stopping auto-continue");
          counters.set(sid, 0);
          return;
        }
        counters.set(sid, n + 1);
        await client.session.promptAsync({
          path: { id: sid },
          body: { parts: [{ type: "text", text: MESSAGE }] },
        });
      } catch (e) {
        console.warn("[autocontinue] " + (e && e.message ? e.message : e));
      } finally {
        inflight.delete(sid);
      }
    },
  };
};
