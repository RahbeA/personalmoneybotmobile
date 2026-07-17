from django.contrib.auth.models import AbstractBaseUser, BaseUserManager, PermissionsMixin
from django.db import models


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
