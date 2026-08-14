from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from courses.models import UserStats
from moneybot.cache_utils import (
    TTL_CHARACTER_CATALOG,
    attach_cache_header,
    cache_get_or_set,
    invalidate_user_cache,
)
from .models import Character, UserCharacter
from .serializers import CharacterSerializer

GUEST_ACCOUNT_REQUIRED = (
    'Create a free account to buy and equip characters. '
    'Learning content is available without signing up.'
)


def _reject_guest(request):
    if getattr(request.user, 'is_guest', False):
        return Response(
            {'detail': GUEST_ACCOUNT_REQUIRED, 'code': 'account_required'},
            status=status.HTTP_403_FORBIDDEN,
        )
    return None


def get_or_create_stats(user):
    stats, created = UserStats.objects.get_or_create(user=user)
    if created or stats.equipped_character_id:
        return UserStats.objects.select_related('equipped_character').get(pk=stats.pk)
    return stats


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def character_list(request):
    def factory():
        characters = Character.objects.filter(is_active=True).order_by('order', 'id')
        serializer = CharacterSerializer(
            characters, many=True,
            context={'request': request, 'owned_ids': set()},
        )
        return serializer.data

    catalog, hit = cache_get_or_set('moneyverse:catalog:v2', factory, TTL_CHARACTER_CATALOG)
    owned_ids = set(
        UserCharacter.objects.filter(user=request.user).values_list('character_id', flat=True)
    )
    stats = get_or_create_stats(request.user)
    characters = []
    for char in catalog:
        entry = dict(char)
        entry['is_owned'] = entry['id'] in owned_ids
        characters.append(entry)

    return attach_cache_header(Response({
        'bot_bucks': stats.bot_bucks,
        'equipped_character_id': stats.equipped_character_id,
        'characters': characters,
    }), hit)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def purchase_character(request, character_id):
    blocked = _reject_guest(request)
    if blocked:
        return blocked

    try:
        character = Character.objects.get(id=character_id, is_active=True)
    except Character.DoesNotExist:
        return Response({'detail': 'Character not found.'}, status=status.HTTP_404_NOT_FOUND)

    stats = get_or_create_stats(request.user)

    if UserCharacter.objects.filter(user=request.user, character=character).exists():
        return Response({'detail': 'You already own this character.'}, status=status.HTTP_400_BAD_REQUEST)

    if stats.bot_bucks < character.price:
        return Response({'detail': 'Not enough Bot Bucks.'}, status=status.HTTP_400_BAD_REQUEST)

    stats.bot_bucks -= character.price
    stats.save(update_fields=['bot_bucks'])
    UserCharacter.objects.create(user=request.user, character=character)

    invalidate_user_cache(request.user.id)

    from courses.badges import evaluate_and_award
    evaluate_and_award(request.user, stats)

    return Response({
        'purchased': True,
        'bot_bucks': stats.bot_bucks,
        'character': CharacterSerializer(
            character, context={'request': request, 'owned_ids': {character.id}}
        ).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def equip_character(request):
    blocked = _reject_guest(request)
    if blocked:
        return blocked

    character_id = request.data.get('character_id')
    stats = get_or_create_stats(request.user)

    # Allow un-equipping by sending no character_id
    if character_id is None:
        stats.equipped_character = None
        stats.save(update_fields=['equipped_character'])
        invalidate_user_cache(request.user.id)
        return Response({'equipped_character_id': None, 'character': None})

    try:
        character = Character.objects.get(id=character_id)
    except Character.DoesNotExist:
        return Response({'detail': 'Character not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not UserCharacter.objects.filter(user=request.user, character=character).exists():
        return Response({'detail': 'You do not own this character.'}, status=status.HTTP_400_BAD_REQUEST)

    stats.equipped_character = character
    stats.save(update_fields=['equipped_character'])

    invalidate_user_cache(request.user.id)

    from courses.badges import evaluate_and_award
    evaluate_and_award(request.user, stats)

    return Response({
        'equipped_character_id': character.id,
        'character': CharacterSerializer(
            character, context={'request': request, 'owned_ids': {character.id}}
        ).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def claim_starter_character(request):
    """
    Grant the cheapest active shop character for free and equip it.
    Available to any authenticated user (including guests finishing onboarding).
    Idempotent: if the user already owns/has an equipped character, return that.
    """
    stats = get_or_create_stats(request.user)

    # Already equipped — return current character without changing ownership.
    if stats.equipped_character_id:
        character = stats.equipped_character
        return Response({
            'claimed': False,
            'already_owned': True,
            'bot_bucks': stats.bot_bucks,
            'character': CharacterSerializer(
                character, context={'request': request, 'owned_ids': {character.id}}
            ).data,
        })

    owned_ids = set(
        UserCharacter.objects.filter(user=request.user).values_list('character_id', flat=True)
    )

    # Admin-chosen starter (falls back to cheapest active if none flagged).
    starter = Character.get_starter()

    newly_granted = False
    if starter is None:
        return Response(
            {'detail': 'No characters available to claim.'},
            status=status.HTTP_404_NOT_FOUND,
        )
    if starter.id not in owned_ids:
        UserCharacter.objects.create(user=request.user, character=starter)
        newly_granted = True
        owned_ids.add(starter.id)

    stats.equipped_character = starter
    stats.save(update_fields=['equipped_character'])
    invalidate_user_cache(request.user.id)

    try:
        from courses.badges import evaluate_and_award
        evaluate_and_award(request.user, stats)
    except Exception:
        # Starter grant should still succeed even if badge eval fails.
        pass

    return Response({
        'claimed': newly_granted,
        'already_owned': not newly_granted,
        'bot_bucks': stats.bot_bucks,
        'character': CharacterSerializer(
            starter, context={'request': request, 'owned_ids': owned_ids}
        ).data,
    })
