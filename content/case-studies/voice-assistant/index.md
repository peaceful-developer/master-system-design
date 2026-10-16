---
slug: voice-assistant
title: Real-time voice assistant
track: C
order: 44
difficulty: intermediate
summary: Hold 50,000 concurrent spoken conversations that start replying about 800 ms after the user stops talking, by streaming speech recognition, the LLM and speech synthesis, and handling interruptions.
concepts: [speech-recognition, voice-activity-detection, text-to-speech, barge-in, latency-budget, time-to-first-token, prefix-caching, kv-cache, tool-calling, udp, offline-evaluation]
prerequisites: [llm-inference-serving]
estimatedMinutes: 4
status: outline
exercises: []
diagram: voice-assistant-hld
---

## Problem statement

Design a voice assistant that holds a natural spoken conversation, in the style of the voice mode in a chat assistant app. The user talks, the assistant answers out loud, and the user can interrupt it at any moment.

The hard part is time. People expect a reply within about a second; longer pauses feel broken. That second is shared by the network, deciding that the user has finished, speech recognition, the LLM and speech synthesis, so every stage must stream. The system must also tell a pause for thought from the end of a turn, stop instantly when interrupted, and keep the cost per minute low.

Questions to ask:

- App, web or phone calls? Which languages?
- What reply delay is acceptable, and must users be able to interrupt?
- Does the assistant call tools, such as looking up an order, mid-conversation?
- How many concurrent sessions at peak, and how long is a typical session?
- Separate speech-to-text, LLM and text-to-speech models, or one speech-to-speech model?

## Requirements

**Functional**

- Hold a two-way streaming audio session from the app or a phone call; the assistant speaks replies and shows a live transcript.
- Detect when the user has finished a turn and reply; stop speaking when the user talks over the assistant.
- Call tools during a turn.
- Keep context across turns, including how much of an interrupted reply the user actually heard.

**Non-functional**

- **Scale:** 50,000 concurrent sessions at peak, averaging 5 minutes each.
- **Latency:** first audio of a reply about 800 ms after the user stops talking at p50, under 1.5 seconds at p95.
- **Interruptions:** assistant audio stops within 200 ms of the user starting to speak.
- **Availability:** 99.9%; if a media server fails, the session reconnects within 2 seconds with its context intact.
- **Cost:** under 5 cents per conversation minute, all models included.

## Key concepts

- :term[Latency budget]{id="latency-budget"}: about 100 ms of network, 250 ms to decide the turn is over, 50 ms for the final transcript, 300 ms for the LLM's first clause and 100 ms to the first audio add up to 800 ms.
- :term[Streaming speech recognition]{id="speech-recognition"}: produces partial transcripts while the user talks, so the full text is ready soon after they stop.
- :term[Voice activity detection]{id="voice-activity-detection"}: runs on every 20 ms audio frame to drive end-of-turn decisions and interruptions, and keeps silence away from the GPUs.
- :term[Barge-in]{id="barge-in"}: the user talking over the assistant must stop playback and cancel generation, and the history must keep only the words actually spoken.
- :term[Time to first token]{id="time-to-first-token"}: the largest slice of the budget, so a fast mid-size model and short prompts keep it near 200 ms.
- :term[Prefix caching]{id="prefix-caching"}: routing each session back to the same LLM replica reuses the :term[KV cache]{id="kv-cache"} of the conversation so far, so a new turn only processes the latest words.
- :term[Text-to-speech]{id="text-to-speech"}: speaks the first clause while the LLM is still writing the rest, so audio starts long before the answer is complete.
- :term[UDP]{id="udp"}: audio travels over UDP (WebRTC) because a late packet is useless; skipping it beats waiting for a resend.
- :term[Offline evaluation]{id="offline-evaluation"}: replaying recorded conversations measures word error rate, users cut off too early, slow replies and task success before any change ships.

## High-level design

::diagram{id="voice-assistant-hld"}

1. The client streams audio to a nearby media server over UDP; phone calls arrive through a telephony gateway. The media server runs voice activity detection and forwards speech frames to streaming speech recognition, which returns partial transcripts as the user talks.
2. The turn manager decides when the user has finished, combining silence from voice activity detection with a check that the transcript sounds complete. It waits about 250 ms instead of a fixed second.
3. It sends the prompt, history and final transcript to the LLM replica that already holds this session's cache. If the model :term[calls a tool]{id="tool-calling"}, the assistant can say a short acknowledgment while it waits.
4. The turn manager cuts streamed tokens at clause boundaries and sends each piece to text-to-speech, which streams audio back through the media server. First audio leaves about 800 ms after the user stopped talking.
5. When the media server hears the user start speaking during playback, it stops the audio within 200 ms; the turn manager cancels LLM and speech synthesis work and records only what was played.
6. Each turn's timings, consented transcripts and outcomes go to call logs. Evals replay recorded audio to tune end-of-turn thresholds, prompts and models.

The full version of this case study will cover the latency budget stage by stage, end-of-turn detection beyond silence, interruption handling and conversation state, GPU capacity for 50,000 streams, and cascaded models versus a single speech-to-speech model.
