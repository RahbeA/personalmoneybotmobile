"""Import Daily puzzle items from a JSON file (or stdin).

Usage:
    python manage.py import_daily_items path/to/items.json
    cat items.json | python manage.py import_daily_items -
"""
import sys

from django.core.management.base import BaseCommand, CommandError

from daily import importer


class Command(BaseCommand):
    help = 'Bulk import Daily puzzle items from a JSON file (use "-" for stdin).'

    def add_arguments(self, parser):
        parser.add_argument('path', help='Path to a JSON file, or "-" to read stdin.')

    def handle(self, *args, **options):
        path = options['path']
        if path == '-':
            raw = sys.stdin.read()
        else:
            try:
                with open(path, 'r', encoding='utf-8') as fh:
                    raw = fh.read()
            except OSError as exc:
                raise CommandError(f'Could not read {path}: {exc}')

        try:
            created, updated = importer.import_json(raw)
        except importer.ImportError_ as exc:
            raise CommandError(str(exc))

        self.stdout.write(self.style.SUCCESS(
            f'Imported successfully: {created} created, {updated} updated.'
        ))
