from django.urls import path
from . import views

urlpatterns = [
    path('characters/', views.character_list, name='character-list'),
    path('characters/<int:character_id>/purchase/', views.purchase_character, name='character-purchase'),
    path('equip/', views.equip_character, name='character-equip'),
]
