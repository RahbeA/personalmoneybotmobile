from rest_framework import serializers
from rest_framework.validators import UniqueValidator
from django.contrib.auth import get_user_model
from django.contrib.auth.password_validation import validate_password

User = get_user_model()


class RegisterSerializer(serializers.ModelSerializer):
    # Email is nullable on the model (for guest accounts) but always required
    # and unique when creating/upgrading a real account.
    email = serializers.EmailField(
        required=True,
        validators=[UniqueValidator(queryset=User.objects.all())],
    )
    password = serializers.CharField(write_only=True, validators=[validate_password])
    name = serializers.CharField(max_length=255, allow_blank=True, required=False)

    class Meta:
        model = User
        fields = ('email', 'password', 'name')

    def validate_name(self, value):
        return (value or '').strip()

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)


class LoginSerializer(serializers.Serializer):
    email = serializers.EmailField()
    password = serializers.CharField()


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'email', 'name', 'avatar_url', 'date_joined', 'is_guest')
        read_only_fields = ('id', 'date_joined', 'is_guest')
