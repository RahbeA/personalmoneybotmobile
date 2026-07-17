from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from courses.models import Module, UserStats
from . import llm, knowledge, prompts
from .models import (
    UserAIProfile, TutorConversation, TutorMessage,
    MoneyChatSession, MoneyChatMessage,
)
from .serializers import (
    TutorConversationSerializer, TutorMessageSerializer, MoneyChatMessageSerializer,
)

# How many recent messages to send back to the model as history.
HISTORY_LIMIT = 12
# Update the rolling learner profile every N user messages.
PROFILE_UPDATE_EVERY = 4

MONEY_CHAT_BONUS_XP = 25
MONEY_CHAT_BONUS_BOT_BUCKS = 15

GUEST_ACCOUNT_REQUIRED = (
    'Create a free account to use the AI Tutor. '
    'Learning content is available without signing up.'
)


def _reject_guest(request):
    if getattr(request.user, 'is_guest', False):
        return Response(
            {'detail': GUEST_ACCOUNT_REQUIRED, 'code': 'account_required'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def get_profile(user):
    profile, _ = UserAIProfile.objects.get_or_create(user=user)
    return profile


def llm_error_response(exc):
    if isinstance(exc, llm.LLMNotConfigured):
        return Response(
            {'detail': 'The AI is not configured yet. Add an OpenAI API key on the server.'},
            status=status.HTTP_503_SERVICE_UNAVAILABLE,
        )
    return Response(
        {'detail': 'The AI had trouble responding. Please try again.'},
        status=status.HTTP_502_BAD_GATEWAY,
    )


# ---------------------------------------------------------------------------
# Tutor
# ---------------------------------------------------------------------------

@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def conversations(request):
    if request.method == 'POST':
        blocked = _reject_guest(request)
        if blocked:
            return blocked
        convo = TutorConversation.objects.create(user=request.user)
        return Response(TutorConversationSerializer(convo).data, status=status.HTTP_201_CREATED)

    qs = TutorConversation.objects.filter(user=request.user)
    return Response(TutorConversationSerializer(qs, many=True).data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def conversation_messages(request, conversation_id):
    try:
        convo = TutorConversation.objects.get(id=conversation_id, user=request.user)
    except TutorConversation.DoesNotExist:
        return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)
    return Response(TutorMessageSerializer(convo.messages.all(), many=True).data)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def tutor_chat(request):
    blocked = _reject_guest(request)
    if blocked:
        return blocked

    message = (request.data.get('message') or '').strip()
    if not message:
        return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

    conversation_id = request.data.get('conversation_id')
    if conversation_id:
        try:
            convo = TutorConversation.objects.get(id=conversation_id, user=request.user)
        except TutorConversation.DoesNotExist:
            return Response({'detail': 'Conversation not found.'}, status=status.HTTP_404_NOT_FOUND)
    else:
        convo = TutorConversation.objects.create(user=request.user)

    user_msg = TutorMessage.objects.create(conversation=convo, role='user', content=message)

    profile = get_profile(request.user)
    system_prompt = prompts.tutor_system_prompt(
        profile,
        knowledge.course_outline(),
        knowledge.relevant_context(message),
    )

    history = list(convo.messages.order_by('-created_at', '-id')[:HISTORY_LIMIT])[::-1]
    llm_messages = [{'role': 'system', 'content': system_prompt}]
    llm_messages += [{'role': m.role, 'content': m.content} for m in history]

    try:
        reply = llm.chat(llm_messages, temperature=0.7, max_tokens=600)
    except (llm.LLMNotConfigured, llm.LLMError) as exc:
        # Roll back the saved user message so retry doesn't duplicate it.
        user_msg.delete()
        return llm_error_response(exc)

    assistant_msg = TutorMessage.objects.create(conversation=convo, role='assistant', content=reply)

    # Title the conversation from the first user message.
    if convo.title == 'New chat':
        convo.title = message[:60]
    convo.save()

    _maybe_update_profile(convo, profile)

    return Response({
        'conversation_id': convo.id,
        'message': TutorMessageSerializer(assistant_msg).data,
    })


def _maybe_update_profile(convo, profile):
    user_count = convo.messages.filter(role='user').count()
    if user_count == 0 or user_count % PROFILE_UPDATE_EVERY != 0:
        return
    recent = list(convo.messages.order_by('-created_at', '-id')[:8])[::-1]
    transcript = '\n'.join(f'{m.role}: {m.content}' for m in recent)
    try:
        data = llm.structured(
            prompts.profile_update_prompt(profile.memory, profile.learning_style, transcript),
            temperature=0.3, max_tokens=400,
        )
        profile.learning_style = (data.get('learning_style') or profile.learning_style)[:500]
        profile.memory = (data.get('memory') or profile.memory)[:2000]
        profile.save()
    except (llm.LLMNotConfigured, llm.LLMError):
        pass  # Profile enrichment is best-effort; never block the chat.


# ---------------------------------------------------------------------------
# Money Chat
# ---------------------------------------------------------------------------

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def money_chat_start(request):
    module_id = request.data.get('module_id')
    try:
        module = Module.objects.get(id=module_id)
    except Module.DoesNotExist:
        return Response({'detail': 'Module not found.'}, status=status.HTTP_404_NOT_FOUND)

    module_ctx = knowledge.module_context(module)

    try:
        gen = llm.structured(
            prompts.benchmark_generation_messages(
                module.title, module_ctx, module.money_chat_criteria,
            ),
            temperature=0.4, max_tokens=600,
        )
        benchmarks = gen.get('benchmarks') or []
    except (llm.LLMNotConfigured, llm.LLMError) as exc:
        return llm_error_response(exc)

    # Normalize benchmark shape and ensure ids.
    normalized = []
    for i, b in enumerate(benchmarks):
        if isinstance(b, dict):
            normalized.append({'id': b.get('id') or f'b{i + 1}', 'text': b.get('text', '')})
        else:
            normalized.append({'id': f'b{i + 1}', 'text': str(b)})

    session = MoneyChatSession.objects.create(
        user=request.user, module=module, benchmarks=normalized,
    )

    profile = get_profile(request.user)
    system_prompt = prompts.money_chat_system_prompt(
        module.title, module_ctx, normalized, profile,
    )
    opener_instruction = {
        'role': 'user',
        'content': (
            "Start the chat with a chill, friendly greeting that references the module "
            f"\"{module.title}\" and asks an easy opening question. Nothing is met yet."
        ),
    }

    try:
        data = llm.structured([
            {'role': 'system', 'content': system_prompt},
            opener_instruction,
        ], temperature=0.7, max_tokens=300)
        reply = data.get('reply') or f"Yo! Let's vibe-check what you picked up in {module.title}. Ready?"
    except (llm.LLMNotConfigured, llm.LLMError) as exc:
        session.delete()
        return llm_error_response(exc)

    greeting = MoneyChatMessage.objects.create(session=session, role='assistant', content=reply)

    return Response({
        'session_id': session.id,
        'message': MoneyChatMessageSerializer(greeting).data,
        'total_benchmarks': len(normalized),
        'met': 0,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def money_chat_message(request):
    session_id = request.data.get('session_id')
    message = (request.data.get('message') or '').strip()
    if not message:
        return Response({'detail': 'Message is required.'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        session = MoneyChatSession.objects.get(id=session_id, user=request.user)
    except MoneyChatSession.DoesNotExist:
        return Response({'detail': 'Session not found.'}, status=status.HTTP_404_NOT_FOUND)

    user_msg = MoneyChatMessage.objects.create(session=session, role='user', content=message)

    module = session.module
    profile = get_profile(request.user)
    system_prompt = prompts.money_chat_system_prompt(
        module.title, knowledge.module_context(module), session.benchmarks, profile,
    )

    history = list(session.messages.order_by('-created_at', '-id')[:HISTORY_LIMIT])[::-1]
    llm_messages = [{'role': 'system', 'content': system_prompt}]
    llm_messages += [{'role': m.role, 'content': m.content} for m in history]

    try:
        data = llm.structured(llm_messages, temperature=0.7, max_tokens=400)
    except (llm.LLMNotConfigured, llm.LLMError) as exc:
        user_msg.delete()
        return llm_error_response(exc)

    reply = data.get('reply') or "Hmm, say more?"
    valid_ids = {b['id'] for b in session.benchmarks}
    met_ids = [bid for bid in (data.get('met_benchmark_ids') or []) if bid in valid_ids]
    passed = bool(data.get('passed')) or (len(met_ids) >= len(valid_ids) and len(valid_ids) > 0)

    session.met_benchmark_ids = met_ids
    bonus = None
    if passed:
        session.passed = True
        session.status = 'passed'
        if not session.bonus_awarded:
            stats, _ = UserStats.objects.get_or_create(user=request.user)
            stats.xp += MONEY_CHAT_BONUS_XP
            stats.bot_bucks += MONEY_CHAT_BONUS_BOT_BUCKS
            stats.save(update_fields=['xp', 'bot_bucks'])
            session.bonus_awarded = True
            bonus = {'xp': MONEY_CHAT_BONUS_XP, 'bot_bucks': MONEY_CHAT_BONUS_BOT_BUCKS}
    session.save()

    assistant_msg = MoneyChatMessage.objects.create(session=session, role='assistant', content=reply)

    return Response({
        'message': MoneyChatMessageSerializer(assistant_msg).data,
        'passed': session.passed,
        'met': len(met_ids),
        'total_benchmarks': len(valid_ids),
        'bonus': bonus,
    })
