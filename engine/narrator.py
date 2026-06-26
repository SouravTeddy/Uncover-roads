"""Narrator: single batched LLM call.

Receives all structured EngineMessages, rewrites what/why/consequence
to persona-matched prose using claude-haiku. Falls back to raw text on failure.
"""
from __future__ import annotations
import json
import os
import anthropic
from engine.types import EngineMessage, EngineContext

_client: anthropic.AsyncAnthropic | None = None


def _get_client() -> anthropic.AsyncAnthropic:
    global _client
    if _client is None:
        _client = anthropic.AsyncAnthropic(api_key=os.environ["ANTHROPIC_API_KEY"])
    return _client


def _build_batch_prompt(messages: list[EngineMessage], persona: dict) -> str:
    archetype = persona.get("archetype", "wanderer")
    msgs_json = json.dumps(
        [{"id": i, "type": m.type, "what": m.what, "why": m.why, "consequence": m.consequence}
         for i, m in enumerate(messages)],
        indent=2,
    )
    return f"""You are narrating itinerary decisions for a travel app. The traveler's persona is: {archetype}.

Rewrite each message's what/why/consequence fields in second-person prose that matches this persona's tone.
- wanderer: curious, informal, loves discovery
- voyager: refined, intentional, appreciates craft
- epicurean: food-forward, sensory, enthusiastic
- historian: thoughtful, context-rich, reverent
- pulse: energetic, social, upbeat
- slowtraveller: deliberate, deep, unhurried
- explorer: adventurous, open, enthusiastic

Return ONLY valid JSON array with the same structure, same "id" fields. Do not add fields. Do not change type.

Messages to rewrite:
{msgs_json}"""


def _parse_narrated_messages(
    response: anthropic.types.Message, originals: list[EngineMessage]
) -> list[EngineMessage]:
    try:
        text = response.content[0].text.strip()
        # Strip markdown code fences if present
        if text.startswith("```"):
            text = text.split("```")[1]
            if text.startswith("json"):
                text = text[4:]
        parsed = json.loads(text)
        narrated = list(originals)
        for item in parsed:
            idx = item["id"]
            if 0 <= idx < len(narrated):
                narrated[idx] = EngineMessage(
                    type=narrated[idx].type,
                    what=item.get("what", narrated[idx].what),
                    why=item.get("why", narrated[idx].why),
                    consequence=item.get("consequence", narrated[idx].consequence),
                    dismissable=narrated[idx].dismissable,
                    undo_key=narrated[idx].undo_key,
                    stop_id=narrated[idx].stop_id,
                )
        return narrated
    except Exception:
        return originals  # fallback: raw structured text


async def narrate(
    messages: list[EngineMessage], ctx: EngineContext
) -> list[EngineMessage]:
    if not messages:
        return messages
    try:
        prompt = _build_batch_prompt(messages, ctx.persona)
        response = await _get_client().messages.create(
            model="claude-haiku-4-5-20251001",
            max_tokens=min(2000, 120 * len(messages)),
            messages=[{"role": "user", "content": prompt}],
        )
        return _parse_narrated_messages(response, messages)
    except Exception:
        return messages  # fallback: return raw messages, never 500
