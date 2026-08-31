from django.core.management.base import BaseCommand

from social.automations import dispatch_due_automations, dispatch_scheduled_campaigns


class Command(BaseCommand):
    help = 'Dispatch scheduled notification campaigns and due notification automations.'

    def handle(self, *args, **options):
        campaigns = dispatch_scheduled_campaigns()
        automations = dispatch_due_automations()
        self.stdout.write(
            self.style.SUCCESS(
                f'Dispatched {campaigns} scheduled campaign(s) and '
                f'{automations} automation notification(s).'
            )
        )
