from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0003_user_avatar_user_chip_balance_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='disclaimer_accepted_at',
            field=models.DateTimeField(blank=True, editable=False, null=True),
        ),
    ]
