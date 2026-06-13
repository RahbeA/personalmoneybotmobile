from django.db import migrations


def seed_onboarding(apps, schema_editor):
    OnboardingQuestion = apps.get_model('courses', 'OnboardingQuestion')
    OnboardingOption = apps.get_model('courses', 'OnboardingOption')

    # Don't duplicate if already seeded.
    if OnboardingQuestion.objects.exists():
        return

    # Import the seed data from the app module (static content).
    from courses.onboarding import SEED_QUESTIONS

    for q_order, q in enumerate(SEED_QUESTIONS):
        question = OnboardingQuestion.objects.create(
            slug=q['id'],
            topic=q['topic'],
            emoji=q.get('emoji', ''),
            vibe=q.get('vibe', ''),
            prompt=q['prompt'],
            order=q_order,
        )
        for o_order, opt in enumerate(q['options']):
            OnboardingOption.objects.create(
                question=question,
                key=opt['id'],
                text=opt['text'],
                is_correct=(opt['id'] == q.get('correct')),
                order=o_order,
            )


def unseed_onboarding(apps, schema_editor):
    OnboardingQuestion = apps.get_model('courses', 'OnboardingQuestion')
    OnboardingQuestion.objects.all().delete()


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0005_onboardingquestion_onboardingoption'),
    ]

    operations = [
        migrations.RunPython(seed_onboarding, unseed_onboarding),
    ]
