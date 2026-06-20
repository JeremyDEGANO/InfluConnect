"""Admin management of subscription plans (features matrix + pricing).

GET  /api/admin/plans/         → feature definitions + merged plan configs
PATCH /api/admin/plans/<code>/ → override price / name / features of one plan
"""
from rest_framework import status
from rest_framework.permissions import IsAdminUser
from rest_framework.response import Response
from rest_framework.views import APIView

from .constants import SUBSCRIPTION_PLANS
from .models import AuditLog, SubscriptionPlanConfig
from .services import plans as plans_service


class AdminPlanConfigListView(APIView):
    permission_classes = [IsAdminUser]

    def get(self, request):
        return Response({
            "feature_defs": plans_service.PLAN_FEATURE_DEFS,
            "plans": plans_service.get_plan_configs(),
        })


class AdminPlanConfigUpdateView(APIView):
    permission_classes = [IsAdminUser]

    def patch(self, request, code):
        if code not in SUBSCRIPTION_PLANS:
            return Response({"detail": "Unknown plan."}, status=status.HTTP_404_NOT_FOUND)

        row, _ = SubscriptionPlanConfig.objects.get_or_create(code=code)
        changed = {}

        if "name" in request.data:
            row.name = str(request.data.get("name") or "").strip()
            changed["name"] = row.name

        if "price_eur_monthly" in request.data:
            raw = request.data.get("price_eur_monthly")
            if raw in (None, ""):
                row.price_eur_monthly = None  # back to the default price
            else:
                try:
                    row.price_eur_monthly = plans_service.validate_price(raw)
                except ValueError as e:
                    return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            changed["price_eur_monthly"] = str(row.price_eur_monthly)

        if "features" in request.data:
            incoming = request.data.get("features") or {}
            if not isinstance(incoming, dict):
                return Response({"detail": "features must be an object."}, status=status.HTTP_400_BAD_REQUEST)
            validated = {}
            for key, value in incoming.items():
                try:
                    validated[key] = plans_service.validate_feature_value(key, value)
                except ValueError as e:
                    return Response({"detail": str(e)}, status=status.HTTP_400_BAD_REQUEST)
            row.features = {**(row.features or {}), **validated}
            changed["features"] = validated

        row.updated_by = request.user
        row.save()

        AuditLog.objects.create(
            actor=request.user, action="plan_config_changed",
            target_type="SubscriptionPlanConfig", target_id=row.id,
            metadata={"plan": code, "changes": changed},
        )
        return Response(plans_service.get_plan_config(code))
