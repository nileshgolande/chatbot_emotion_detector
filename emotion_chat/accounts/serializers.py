from django.contrib.auth.models import User
from rest_framework import serializers

from .models import UserProfile


class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ("id", "username", "email")


class RegisterSerializer(serializers.Serializer):
    username = serializers.CharField(max_length=150)
    email = serializers.EmailField(required=False, allow_blank=True)
    password = serializers.CharField(write_only=True, min_length=8)
    password_confirm = serializers.CharField(write_only=True, min_length=8)

    def validate(self, attrs):
        if attrs["password"] != attrs["password_confirm"]:
            raise serializers.ValidationError(
                {"password_confirm": "Passwords do not match."}
            )
        return attrs

    def create(self, validated_data):
        validated_data.pop("password_confirm", None)
        user = User.objects.create_user(
            username=validated_data["username"],
            email=validated_data.get("email") or "",
            password=validated_data["password"],
        )
        UserProfile.objects.get_or_create(user=user)
        return user


class ProfileSerializer(serializers.ModelSerializer):
    username = serializers.CharField(source="user.username", read_only=True)
    email = serializers.EmailField(source="user.email", read_only=True)

    class Meta:
        model = UserProfile
        fields = ("username", "email", "bio", "profile_picture")

    def to_representation(self, instance):
        ret = super().to_representation(instance)
        request = self.context.get("request")
        pic = instance.profile_picture
        if request and pic:
            try:
                ret["profile_picture"] = request.build_absolute_uri(pic.url)
            except Exception:
                pass
        return ret
