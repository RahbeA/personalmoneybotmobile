from django.db import migrations


TIPS = [
    ('general', "Small money moves add up. Track one purchase today before you tap pay."),
    ('budget', "Give every dollar a job. Even a messy budget beats no budget."),
    ('saving', "Pay your future self first. Automate a tiny transfer you won't miss."),
    ('credit', "Pay on time, every time. That's the fastest way to look good to lenders."),
    ('investing', "Time in the market beats timing the market. Start small and stay consistent."),
    ('stocks', "Don't buy a stock just because it's trending. Know what the company actually does."),
    ('budget', "Wants vs needs: if you'd be fine without it in 30 days, it's a want."),
    ('saving', "An emergency fund is boring until the day it saves you."),
    ('credit', "A credit card is a tool, not extra income. If you can't pay it this month, skip it."),
    ('general', "Talking about money with people you trust is a skill. Practice it."),
]


def seed_tips(apps, schema_editor):
    MoneyTip = apps.get_model('courses', 'MoneyTip')
    if MoneyTip.objects.exists():
        return
    MoneyTip.objects.bulk_create([
        MoneyTip(body=body, category=category, is_active=True, order=index)
        for index, (category, body) in enumerate(TIPS)
    ])


def unseed_tips(apps, schema_editor):
    MoneyTip = apps.get_model('courses', 'MoneyTip')
    MoneyTip.objects.filter(body__in=[body for _, body in TIPS]).delete()


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0011_sprint_mobile_shared_models'),
    ]

    operations = [
        migrations.RunPython(seed_tips, unseed_tips),
    ]
