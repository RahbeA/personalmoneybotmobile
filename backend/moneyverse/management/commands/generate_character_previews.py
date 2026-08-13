"""Generate PNG stills from character GLBs into preview_image."""

from django.core.management.base import BaseCommand
from django.db.models import Q

from adminapi.glb_preview import GlbPreviewError, apply_preview_to_character
from moneyverse.models import Character


class Command(BaseCommand):
    help = 'Render PNG previews from each character GLB (skips ones that already have a preview unless --force).'

    def add_arguments(self, parser):
        parser.add_argument(
            '--force',
            action='store_true',
            help='Overwrite existing preview_image files',
        )
        parser.add_argument(
            '--size',
            type=int,
            default=512,
            help='Output square size in pixels (128–1024)',
        )
        parser.add_argument(
            '--id',
            type=int,
            default=None,
            help='Only process this character id',
        )

    def handle(self, *args, **options):
        force = options['force']
        size = options['size']
        char_id = options['id']

        qs = Character.objects.exclude(model_file='').exclude(model_file=None).order_by('order', 'id')
        if char_id:
            qs = qs.filter(pk=char_id)
        elif not force:
            qs = qs.filter(Q(preview_image='') | Q(preview_image__isnull=True))

        total = qs.count()
        if total == 0:
            self.stdout.write(self.style.WARNING('No characters to process.'))
            return

        ok = skipped = failed = 0
        for character in qs.iterator():
            try:
                stats = apply_preview_to_character(character, size=size, force=force)
                if stats.get('skipped'):
                    skipped += 1
                    self.stdout.write(f'  skip  #{character.id} {character.name}')
                else:
                    ok += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'  ok    #{character.id} {character.name} '
                        f'({stats.get("bytesOut", "?")} bytes)'
                    ))
            except GlbPreviewError as exc:
                failed += 1
                self.stderr.write(self.style.ERROR(
                    f'  fail  #{character.id} {character.name}: {exc}'
                ))

        self.stdout.write(self.style.NOTICE(
            f'Done: {ok} generated, {skipped} skipped, {failed} failed (of {total})'
        ))
