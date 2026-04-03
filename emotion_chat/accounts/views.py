from rest_framework import permissions, status, viewsets
from rest_framework.decorators import action
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework_simplejwt.tokens import RefreshToken

from .models import UserProfile
from .serializers import ProfileSerializer, RegisterSerializer, UserSerializer


class RegisterView(APIView):
    permission_classes = [permissions.AllowAny]

    def post(self, request):
        ser = RegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        refresh = RefreshToken.for_user(user)
        return Response(
            {
                "user": UserSerializer(user).data,
                "access": str(refresh.access_token),
                "refresh": str(refresh),
            },
            status=status.HTTP_201_CREATED,
        )


class UserProfileViewSet(viewsets.ViewSet):
    permission_classes = (permissions.IsAuthenticated,)
    parser_classes = [JSONParser, FormParser, MultiPartParser]

    @action(detail=False, methods=["get", "patch"], url_path="me")
    def me(self, request):
        profile, _ = UserProfile.objects.get_or_create(user=request.user)
        if request.method == "GET":
            data = {
                "id": request.user.id,
                "username": request.user.username,
                "email": request.user.email,
            }
            data.update(ProfileSerializer(profile, context={"request": request}).data)
            return Response(data)
        ser = ProfileSerializer(
            profile,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        data = {
            "id": request.user.id,
            "username": request.user.username,
            "email": request.user.email,
        }
        profile.refresh_from_db()
        data.update(ProfileSerializer(profile, context={"request": request}).data)
        return Response(data)
