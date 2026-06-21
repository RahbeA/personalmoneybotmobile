from django.apps import AppConfig


class MoneyverseConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'moneyverse'
    verbose_name = 'Moneyverse'

    def ready(self):
        import moneyverse.signals  # noqa: F401
