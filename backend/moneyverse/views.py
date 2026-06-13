from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from courses.models import UserStats
from .models import Character, UserCharacter
from .serializers import CharacterSerializer


def get_or_create_stats(user):
    stats, _ = UserStats.objects.get_or_create(user=user)
    return stats


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def character_list(request):
    characters = Character.objects.filter(is_active=True)
    owned_ids = set(
        UserCharacter.objects.filter(user=request.user).values_list('character_id', flat=True)
    )
    stats = get_or_create_stats(request.user)
    serializer = CharacterSerializer(
        characters, many=True,
        context={'request': request, 'owned_ids': owned_ids},
    )
    return Response({
        'bot_bucks': stats.bot_bucks,
        'equipped_character_id': stats.equipped_character_id,
        'characters': serializer.data,
    })


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
        return Response({'equipped_character_id': None, 'character': None})

    try:
        character = Character.objects.get(id=character_id)
    except Character.DoesNotExist:
        return Response({'detail': 'Character not found.'}, status=status.HTTP_404_NOT_FOUND)

    if not UserCharacter.objects.filter(user=request.user, character=character).exists():
        return Response({'detail': 'You do not own this character.'}, status=status.HTTP_400_BAD_REQUEST)

    stats.equipped_character = character
    stats.save(update_fields=['equipped_character'])
    return Response({
        'equipped_character_id': character.id,
        'character': CharacterSerializer(
            character, context={'request': request, 'owned_ids': {character.id}}
        ).data,
    })
