from django.db import models
from django.conf import settings


class Character(models.Model):
    RARITY_CHOICES = [
        ('common', 'Common'),
        ('rare', 'Rare'),
        ('epic', 'Epic'),
        ('legendary', 'Legendary'),
    ]

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    price = models.PositiveIntegerField(default=100, help_text='Cost in Bot Bucks')
    rarity = models.CharField(max_length=20, choices=RARITY_CHOICES, default='common')
    accent_color = models.CharField(
        max_length=9, blank=True, default='#3DDC5F',
        help_text='Hex color used to theme this character card',
    )
    model_file = models.FileField(upload_to='characters/', help_text='.glb 3D model file')
    preview_image = models.ImageField(upload_to='character_previews/', null=True, blank=True)
    order = models.PositiveIntegerField(default=0)
    is_active = models.BooleanField(default=True)

    class Meta:
        ordering = ['order', 'id']

    def __str__(self):
        return self.name


class UserCharacter(models.Model):
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='owned_characters'
    )
    character = models.ForeignKey(Character, on_delete=models.CASCADE, related_name='owners')
    acquired_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        unique_together = ('user', 'character')
        ordering = ['-acquired_at']

    def __str__(self):
        return f"{self.user.email} owns {self.character.name}"
