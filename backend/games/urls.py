from django.urls import path

from . import views

urlpatterns = [
    path('', views.arcade_catalog, name='arcade-catalog'),
    path('<str:game_key>/start/', views.start_game, name='game-start'),
    path('<str:game_key>/finish/', views.finish_game, name='game-finish'),
]
