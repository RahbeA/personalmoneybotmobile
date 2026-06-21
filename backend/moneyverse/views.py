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

    catalog, hit = cache_get_or_set('moneyverse:catalog:v1', factory, TTL_CHARACTER_CATALOG)
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
