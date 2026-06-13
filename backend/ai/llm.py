"""Central OpenAI client helpers.

All AI calls in the app go through this module so the API key stays server-side
and configuration (model, error handling) lives in one place.
"""
import json

from django.conf import settings
from openai import OpenAI


class LLMNotConfigured(Exception):
    """Raised when no OpenAI API key is configured."""


class LLMError(Exception):
    """Raised when an OpenAI request fails."""


_client = None


def get_client():
    global _client
    if not settings.OPENAI_API_KEY:
        raise LLMNotConfigured(
            'OpenAI API key is not set. Add OPENAI_API_KEY to backend/.env.'
        )
    if _client is None:
        _client = OpenAI(api_key=settings.OPENAI_API_KEY)
    return _client


def chat(messages, temperature=0.7, max_tokens=600, model=None):
    """Plain text chat completion. `messages` is a list of {role, content}."""
    client = get_client()
    try:
        response = client.chat.completions.create(
            model=model or settings.OPENAI_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
        )
        return response.choices[0].message.content.strip()
    except LLMNotConfigured:
        raise
    except Exception as exc:  # noqa: BLE001 - surface a clean error to the view
        raise LLMError(str(exc)) from exc


def structured(messages, temperature=0.4, max_tokens=800, model=None):
    """Chat completion that returns parsed JSON (response_format json_object).

    The caller must instruct the model (in the system/user message) to respond
    with JSON. Returns a Python dict.
    """
    client = get_client()
    try:
        response = client.chat.completions.create(
            model=model or settings.OPENAI_MODEL,
            messages=messages,
            temperature=temperature,
            max_tokens=max_tokens,
            response_format={'type': 'json_object'},
        )
        content = response.choices[0].message.content
        return json.loads(content)
    except LLMNotConfigured:
        raise
    except json.JSONDecodeError as exc:
        raise LLMError(f'Model did not return valid JSON: {exc}') from exc
    except Exception as exc:  # noqa: BLE001
        raise LLMError(str(exc)) from exc
