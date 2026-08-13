import secrets
import string

from django.conf import settings
from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.core.cache import cache
from django.db import models, transaction
from django.utils import timezone


class UserManager(BaseUserManager):
    def create_user(self, email, password=None, **extra_fields):
        if not email:
            raise ValueError('Email is required')
        email = self.normalize_email(email)
        user = self.model(email=email, **extra_fields)
        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_guest_user(self, **extra_fields):
        """Create an anonymous account with no email/password.

        Used for "Continue as guest" so users can access non-account content
        without entering personal info (App Store Guideline 5.1.1(v)). A guest
        can later upgrade to a real account, preserving their progress.
        """
        extra_fields.setdefault('is_guest', True)
        user = self.model(email=None, **extra_fields)
        user.set_unusable_password()
        user.save(using=self._db)
        return user

    def create_superuser(self, email, password=None, **extra_fields):
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        return self.create_user(email, password, **extra_fields)


class User(AbstractBaseUser, PermissionsMixin):
    # Nullable so anonymous "guest" accounts can exist without an email. Real
    # accounts still enforce uniqueness; multiple NULLs are allowed.
    email = models.EmailField(unique=True, null=True, blank=True)
    name = models.CharField(max_length=255, blank=True, default='')
    avatar_url = models.URLField(blank=True, default='')
    # Google's stable account identifier (the "sub" claim). Null for password-only users.
    google_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    # Apple's stable account identifier (the "sub" claim). Null for non-Apple users.
    apple_id = models.CharField(max_length=255, unique=True, null=True, blank=True)
    # True for anonymous "Continue as guest" accounts until they upgrade.
    is_guest = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    # Set when an admin's password was created/reset by someone else, so the
    # control panel can force them to set their own password on next sign-in.
    must_change_password = models.BooleanField(default=False)
    date_joined = models.DateTimeField(auto_now_add=True)

    objects = UserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = []

    def __str__(self):
        return self.email or f'Guest #{self.pk}'


# Characters that are easy to read/share (no 0/O/1/I ambiguity).
_INVITE_ALPHABET = string.ascii_uppercase + string.digits
_INVITE_ALPHABET = (
    _INVITE_ALPHABET
    .replace('0', '')
    .replace('O', '')
    .replace('1', '')
    .replace('I', '')
)
INVITE_CODE_LENGTH = 8
INVITE_CONFIG_CACHE_KEY = 'accounts:invite_config:v1'


def generate_invite_code(length=INVITE_CODE_LENGTH):
    return ''.join(secrets.choice(_INVITE_ALPHABET) for _ in range(length))


class InviteConfig(models.Model):
    """Singleton (pk=1) controlling invite-only signup mode."""

    invite_only_enabled = models.BooleanField(default=True)
    invites_per_user = models.PositiveIntegerField(default=10)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'Invite configuration'
        verbose_name_plural = 'Invite configuration'

    def __str__(self):
        state = 'ON' if self.invite_only_enabled else 'OFF'
        return f'Invite-only {state} · {self.invites_per_user}/user'

    def save(self, *args, **kwargs):
        self.pk = 1
        super().save(*args, **kwargs)
        cache.delete(INVITE_CONFIG_CACHE_KEY)

    def delete(self, *args, **kwargs):
        super().delete(*args, **kwargs)
        cache.delete(INVITE_CONFIG_CACHE_KEY)

    @classmethod
    def get(cls):
        cached = cache.get(INVITE_CONFIG_CACHE_KEY)
        if cached is not None:
            return cached

        defaults = {
            'invite_only_enabled': bool(getattr(settings, 'INVITE_ONLY_DEFAULT', True)),
            'invites_per_user': int(getattr(settings, 'INVITES_PER_USER', 10)),
        }
        obj, _ = cls.objects.get_or_create(pk=1, defaults=defaults)
        cache.set(INVITE_CONFIG_CACHE_KEY, obj, timeout=60)
        return obj


class Invite(models.Model):
    code = models.CharField(max_length=16, unique=True, db_index=True)
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='invites_sent',
        help_text='Null for admin/seed invites.',
    )
    # Legacy single-use bookkeeping. Reusable personal codes track their joins in
    # InviteClaim instead; used_by stays null for those. Kept so admin/seed
    # single-use invites keep displaying who redeemed them.
    used_by = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name='invite_used',
    )
    used_at = models.DateTimeField(null=True, blank=True)
    # How many times this code can be redeemed. Personal codes default to the
    # per-user allotment; admin/seed codes stay single-use (1).
    max_uses = models.PositiveIntegerField(default=1)
    # Denormalized count of successful redemptions (source of truth: InviteClaim).
    uses_count = models.PositiveIntegerField(default=0)
    created_at = models.DateTimeField(auto_now_add=True)
    note = models.CharField(max_length=255, blank=True, default='')
    is_revoked = models.BooleanField(default=False)

    class Meta:
        ordering = ['-created_at', 'id']

    def __str__(self):
        return self.code

    @property
    def remaining(self):
        return max(int(self.max_uses or 0) - int(self.uses_count or 0), 0)

    @property
    def status(self):
        if self.is_revoked:
            return 'revoked'
        if self.remaining <= 0:
            return 'used'
        return 'available'

    @property
    def join_url(self):
        base = getattr(settings, 'INVITE_JOIN_BASE_URL', 'https://getmoneybot.com/join').rstrip('/')
        return f'{base}/{self.code}'

    @classmethod
    def normalize_code(cls, raw):
        return (raw or '').strip().upper()

    @classmethod
    def _new_unique_code(cls):
        for _attempt in range(20):
            code = generate_invite_code()
            if not cls.objects.filter(code=code).exists():
                return code
        raise RuntimeError('Could not generate a unique invite code')

    @classmethod
    def create_unique(cls, *, created_by=None, note='', count=1, max_uses=1):
        """Create one or more invites with unique codes."""
        created = []
        for _ in range(max(0, int(count))):
            created.append(cls.objects.create(
                code=cls._new_unique_code(),
                created_by=created_by,
                note=note or '',
                max_uses=max(1, int(max_uses)),
            ))
        return created

    def regenerate_code(self):
        """Swap in a fresh code string, keeping claims/attribution and counts.

        The old code stops resolving immediately. Uses already consumed stay
        consumed so regenerating can't be abused to mint unlimited invites.
        """
        self.code = type(self)._new_unique_code()
        self.is_revoked = False
        self.save(update_fields=['code', 'is_revoked'])
        return self

    @classmethod
    def claim(cls, code, user):
        """
        Atomically redeem an invite for `user` and record attribution.
        Returns the Invite on success. Raises InviteError on failure.
        """
        normalized = cls.normalize_code(code)
        if not normalized:
            raise InviteError('invite_required', 'An invite code is required to create an account.')

        with transaction.atomic():
            invite = (
                cls.objects.select_for_update()
                .filter(code=normalized)
                .first()
            )
            if invite is None:
                raise InviteError('invite_invalid', 'That invite code is not valid.')
            if invite.is_revoked:
                raise InviteError('invite_invalid', 'That invite code has been revoked.')
            if invite.created_by_id and invite.created_by_id == user.id:
                raise InviteError('invite_self', "You can't redeem your own invite code.")
            if InviteClaim.objects.filter(user=user).exists():
                raise InviteError('invite_already_claimed', 'This account has already used an invite code.')
            if invite.remaining <= 0:
                raise InviteError('invite_invalid', 'That invite code has already been used up.')

            InviteClaim.objects.create(invite=invite, user=user)
            invite.uses_count = int(invite.uses_count or 0) + 1
            update_fields = ['uses_count']
            # Preserve legacy single-use bookkeeping for admin/seed codes.
            if int(invite.max_uses or 1) <= 1 and not invite.used_by_id:
                invite.used_by = user
                invite.used_at = timezone.now()
                update_fields += ['used_by', 'used_at']
            invite.save(update_fields=update_fields)
            return invite


class InviteClaim(models.Model):
    """Attribution row: which invite a joining user came through.

    Source of truth for reusable-invite redemption counts and referral rewards.
    """

    invite = models.ForeignKey(Invite, on_delete=models.CASCADE, related_name='claims')
    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='invite_claim',
    )
    # True once the inviter has been credited Bot Bucks for this join.
    rewarded = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-created_at', 'id']

    def __str__(self):
        return f'user {self.user_id} via invite {self.invite_id}'


class InviteError(Exception):
    def __init__(self, code, detail):
        self.code = code
        self.detail = detail
        super().__init__(detail)


def get_or_create_personal_invite(user):
    """Return a real user's single reusable invite code.

    Collapses any legacy per-user allotment of single-use codes into one
    reusable code, folding prior claims onto it so attribution is preserved.
    """
    if not user or not user.pk or getattr(user, 'is_guest', False):
        return None

    config = InviteConfig.get()
    max_uses = max(1, int(config.invites_per_user or 1))
    personal = list(
        Invite.objects.filter(created_by=user, is_revoked=False).order_by('created_at', 'id')
    )

    if not personal:
        return Invite.create_unique(created_by=user, count=1, max_uses=max_uses)[0]

    primary = personal[0]
    extras = personal[1:]
    dirty = set()

    if extras:
        with transaction.atomic():
            for extra in extras:
                InviteClaim.objects.filter(invite=extra).update(invite=primary)
                extra.is_revoked = True
                extra.save(update_fields=['is_revoked'])
            primary.uses_count = InviteClaim.objects.filter(invite=primary).count()
            dirty.add('uses_count')

    if int(primary.max_uses or 1) != max_uses:
        primary.max_uses = max_uses
        dirty.add('max_uses')

    if dirty:
        primary.save(update_fields=list(dirty))
    return primary


def ensure_user_invites(user):
    """Back-compat wrapper: ensure the user's single reusable invite exists."""
    invite = get_or_create_personal_invite(user)
    return [invite] if invite else []


def invite_only_enabled():
    return bool(InviteConfig.get().invite_only_enabled)
