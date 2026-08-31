"""Shared Redis/LocMem cache helpers for API response caching."""
import copy
import hashlib
import logging
import os

from django.core.cache import cache

logger = logging.getLogger(__name__)

CACHE_DEBUG = os.environ.get('DJANGO_CACHE_DEBUG', '').lower() in ('1', 'true', 'yes')

# TTL seconds
TTL_ONBOARDING = 24 * 60 * 60
TTL_LESSON_QUESTIONS = 24 * 60 * 60
TTL_COURSE_OUTLINE = 60 * 60
TTL_LEADERBOARD = 60
TTL_CHARACTER_CATALOG = 10 * 60
TTL_USER_MODULES = 90
TTL_USER_STATS = 60


def cache_get_or_set(key, factory, ttl):
    """Return (value, hit_bool)."""
    cached = cache.get(key)
    if cached is not None:
        if CACHE_DEBUG:
            logger.info('cache=HIT key=%s', key)
        return cached, True

    value = factory()
    cache.set(key, value, ttl)
    if CACHE_DEBUG:
        logger.info('cache=MISS key=%s', key)
    return value, False


def cache_status_header(hit):
    return 'HIT' if hit else 'MISS'


def attach_cache_header(response, hit):
    response['X-Cache-Status'] = cache_status_header(hit)
    return response


def _user_cache_version_key(user_id):
    return f'user:{user_id}:cachever'


def user_cache_version(user_id):
    """Current per-user cache version, baked into modules/stats cache keys.

    Bumping this on every write is what makes cache invalidation race-proof: a
    modules/stats snapshot rebuilt from a pre-write DB read (i.e. an in-flight
    GET that started before a completion) writes itself under the OLD version
    key, which nothing reads again. The next GET uses the new version, misses,
    and rebuilds fresh from the database.
    """
    key = _user_cache_version_key(user_id)
    version = cache.get(key)
    if version is None:
        # timeout=None => persist (no TTL) so the version survives longer than
        # the short-lived modules/stats snapshots it namespaces.
        cache.set(key, 1, None)
        return 1
    return version


def bump_user_cache_version(user_id):
    key = _user_cache_version_key(user_id)
    try:
        return cache.incr(key)
    except ValueError:
        # Key was never set (or expired) — start a fresh version ahead of 1 so
        # any snapshot cached under the implicit v1 is abandoned.
        cache.set(key, 2, None)
        return 2


def user_modules_cache_key(user_id):
    return f'user:{user_id}:modules:v1:cv{user_cache_version(user_id)}'


def user_stats_cache_key(user_id):
    return f'user:{user_id}:stats:v2:cv{user_cache_version(user_id)}'


def invalidate_user_cache(user_id):
    # Bump the per-user cache version so any modules/stats snapshot still being
    # rebuilt from a pre-write DB read lands under the previous version key and
    # is never served again (closes the non-atomic cache_get_or_set race that
    # let a stale "lesson incomplete" roadmap resurrect right after completion).
    bump_user_cache_version(user_id)


def invalidate_badge_catalog_cache():
    """Bust badge catalog and all cached user stats (they embed badge_catalog)."""
    cache.delete('course:badge_catalog:v1')
    _delete_pattern('user:')


def invalidate_course_content():
    """Bust global course-related cache keys."""
    from django.core.cache import cache
    cache.delete('course:onboarding:questions:v1')
    cache.delete('course:outline:v1')
    _delete_pattern('course:lesson:')
    invalidate_leaderboard_snapshots()


def invalidate_lesson_questions(lesson_id):
    cache.delete(f'course:lesson:{lesson_id}:questions:v1')


def invalidate_leaderboard_snapshots():
    _delete_pattern('leaderboard:snapshot:')


def _delete_pattern(prefix):
    delete_pattern = getattr(cache, 'delete_pattern', None)
    if delete_pattern:
        delete_pattern(f'{prefix}*')
        return
    # LocMem fallback — no pattern delete; keys expire via TTL.


def leaderboard_cache_key(page, page_size, search):
    search_hash = hashlib.md5(search.encode('utf-8')).hexdigest()[:12]
    return f'leaderboard:snapshot:v1:page:{page}:size:{page_size}:search:{search_hash}'


def strip_leaderboard_user_flags(payload):
    """Return a copy safe to share across users in Redis."""
    data = copy.deepcopy(payload)
    data['me'] = None
    for section in ('top', 'entries'):
        for entry in data.get(section) or []:
            entry['is_me'] = False
    return data


def apply_leaderboard_user_flags(payload, request, me_entry):
    """Merge per-user me card and is_me flags into a cached leaderboard payload."""
    data = copy.deepcopy(payload)
    data['me'] = me_entry
    my_id = request.user.id
    for section in ('top', 'entries'):
        for entry in data.get(section) or []:
            entry['is_me'] = entry.get('user_id') == my_id
    if me_entry:
        me_entry = copy.deepcopy(me_entry)
        me_entry['is_me'] = True
        data['me'] = me_entry
    return data
