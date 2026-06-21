# Cache test matrix

Run on TestFlight (mobile) + Railway staging with `REDIS_URL` set.

| Test | Steps | Pass criteria |
|------|-------|---------------|
| Boot hydration | Kill app, reopen while signed in | Home/Courses paint within ~500ms from cached progress; network refresh updates silently |
| Lesson cache | Open same lesson intro twice | Second visit: no new `GET .../lessons/{id}/questions/` in Metro logs |
| Leaderboard Redis | Two devices open leaderboard within 60s | Second response header `X-Cache-Status: HIT`; ranks match |
| Leaderboard client | Open leaderboard twice within 45s | Second open uses `[ApiCache] READ ← memory` |
| Invalidation | Complete a lesson | Next modules list shows completion; backend deletes `user:{id}:modules:v1` |
| Model cache | Clear model cache in Settings debug panel | One `MODEL ← network`, then `disk` on relaunch |
| API cache clear | Tap "Clear cache" in API debug panel | Next boot shows cache misses until data re-fetched |
| Redis down | Unset `REDIS_URL` on staging | App still works; all `X-Cache-Status: MISS` |
| Admin health | `GET /api/admin/cache/health/` with staff token | `ping_ok: true` when Redis is up |
| Load test | `TOKEN=... API_BASE=... ./backend/scripts/load_test_cache.sh` | p95 &lt; 500ms on cached reads after warm-up |

## Env vars

- **Railway:** `REDIS_URL=redis://...` (Redis plugin)
- **Backend debug:** `DJANGO_CACHE_DEBUG=1` logs `cache=HIT|MISS`
- **Mobile debug:** `EXPO_PUBLIC_MODEL_CACHE_DEBUG=1` or `EXPO_PUBLIC_CACHE_DEBUG=1`

## Post-deploy

```bash
python manage.py cache_warm
```
