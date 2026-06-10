from rest_framework_simplejwt.authentication import JWTAuthentication


class QueryParamJWTAuthentication(JWTAuthentication):
    """JWT auth that also accepts ?token=<access_jwt> for docs pages."""

    def authenticate(self, request):
        header = self.get_header(request)
        if header is not None:
            raw_token = self.get_raw_token(header)
            if raw_token is None:
                return None
            validated_token = self.get_validated_token(raw_token)
            return self.get_user(validated_token), validated_token

        query_token = request.query_params.get("token")
        if not query_token:
            return None
        validated_token = self.get_validated_token(query_token.encode("utf-8"))
        return self.get_user(validated_token), validated_token
