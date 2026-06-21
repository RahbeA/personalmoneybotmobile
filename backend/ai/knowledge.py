"""Assembles course content into compact text context for the LLM.

Uses only existing course data (Module/Lesson/Question/Answer), so no schema
changes are required. Keeps token usage bounded by including a cheap full
outline plus the detailed Q&A of only the most relevant module(s).
"""
import re

from courses.models import Module
from moneybot.cache_utils import TTL_COURSE_OUTLINE, cache_get_or_set


_STOPWORDS = {
    'the', 'a', 'an', 'and', 'or', 'is', 'are', 'to', 'of', 'in', 'on', 'for',
    'what', 'how', 'why', 'do', 'does', 'i', 'my', 'me', 'can', 'should', 'with',
    'about', 'this', 'that', 'it', 'be', 'if', 'when', 'which', 'you', 'your',
}


def _tokenize(text):
    return [w for w in re.findall(r'[a-z0-9]+', (text or '').lower()) if w not in _STOPWORDS]


def _build_course_outline():
    lines = ['COURSE OUTLINE:']
    for module in Module.objects.prefetch_related('lessons').all():
        lines.append(f'- Module {module.order}: {module.title} - {module.description}')
        lesson_titles = ', '.join(l.title for l in module.lessons.all())
        if lesson_titles:
            lines.append(f'  Lessons: {lesson_titles}')
    return '\n'.join(lines)


def course_outline():
    """Compact outline of every module and its lessons. Always cheap to include."""
    outline, _ = cache_get_or_set('course:outline:v1', _build_course_outline, TTL_COURSE_OUTLINE)
    return outline


def module_context(module):
    """Full lesson + Q&A detail for a single module."""
    lines = [f'MODULE: {module.title}', f'Overview: {module.description}', '']
    for lesson in module.lessons.prefetch_related('questions__answers').all():
        lines.append(f'Lesson: {lesson.title}')
        for q in lesson.questions.all():
            lines.append(f'  Q: {q.prompt}')
            correct = [a.text for a in q.answers.all() if a.is_correct]
            if correct:
                lines.append(f'  Correct: {"; ".join(correct)}')
            if q.explanation:
                lines.append(f'  Explanation: {q.explanation}')
        lines.append('')
    return '\n'.join(lines).strip()


def relevant_context(query, max_modules=2):
    """Return detailed context for the module(s) most relevant to `query`."""
    query_tokens = set(_tokenize(query))
    modules = list(Module.objects.prefetch_related('lessons__questions__answers').all())

    if not query_tokens:
        # No usable keywords - return nothing extra (outline still provided elsewhere).
        return ''

    scored = []
    for module in modules:
        haystack = ' '.join([
            module.title, module.description,
            ' '.join(l.title for l in module.lessons.all()),
            ' '.join(q.prompt for l in module.lessons.all() for q in l.questions.all()),
        ])
        module_tokens = set(_tokenize(haystack))
        score = len(query_tokens & module_tokens)
        if score:
            scored.append((score, module))

    scored.sort(key=lambda x: x[0], reverse=True)
    top = [m for _, m in scored[:max_modules]]
    if not top:
        return ''
    return '\n\n'.join(module_context(m) for m in top)
