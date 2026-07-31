from django.core.cache import cache
from django.core.management.base import BaseCommand

from courses import onboarding


class Command(BaseCommand):
    help = 'Pre-warm shared Redis cache keys after deploy.'

    def handle(self, *args, **options):
        from moneybot.cache_utils import (
            TTL_COURSE_OUTLINE,
            TTL_LEADERBOARD,
            TTL_ONBOARDING,
            cache_get_or_set,
            leaderboard_cache_key,
            strip_leaderboard_user_flags,
        )
        from ai.knowledge import _build_course_outline
        from courses.views import LEADERBOARD_TOP_N, _build_leaderboard_payload
        from django.test import RequestFactory
        from accounts.models import User

        onboarding_data, hit = cache_get_or_set(
            'course:onboarding:questions:v1',
            lambda: {
                'questions': onboarding.public_questions(),
                'total': onboarding.total_questions(),
            },
            TTL_ONBOARDING,
        )
        self.stdout.write(f'onboarding: questions={len(onboarding_data.get("questions", []))} hit={hit}')

        outline, hit = cache_get_or_set(
            'course:outline:v1',
            _build_course_outline,
            TTL_COURSE_OUTLINE,
        )
        self.stdout.write(f'outline: chars={len(outline)} hit={hit}')

        staff = User.objects.filter(is_staff=True).first() or User.objects.first()
        if staff:
            factory = RequestFactory()
            req = factory.get('/api/courses/leaderboard/')
            req.user = staff
            key = leaderboard_cache_key(1, LEADERBOARD_TOP_N, '')
            payload, hit = cache_get_or_set(
                key,
                lambda: strip_leaderboard_user_flags(
                    _build_leaderboard_payload(req),
                ),
                TTL_LEADERBOARD,
            )
            self.stdout.write(
                f'leaderboard top{LEADERBOARD_TOP_N}: top={len(payload.get("top", []))} hit={hit}',
            )
        else:
            self.stdout.write('leaderboard: skipped (no users)')

        try:
            cache.set('_cache_warm_ok', True, 60)
        except Exception as exc:
            self.stderr.write(f'cache ping failed: {exc}')
        else:
            self.stdout.write(self.style.SUCCESS('Cache warm complete.'))
