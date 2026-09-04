from __future__ import annotations

import json
import logging
import re
import time
import uuid


logger = logging.getLogger("api.request")

# Never write credentials or one-time codes passed as query params to logs.
_SENSITIVE_QUERY_RE = re.compile(r"((?:^|[?&])(?:token|access|refresh|code|state)=)[^&]+", re.IGNORECASE)


def _redact(path: str) -> str:
    return _SENSITIVE_QUERY_RE.sub(r"\1[redacted]", path)


class RequestLogMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        started = time.perf_counter()
        request_id = request.META.get("HTTP_X_REQUEST_ID") or str(uuid.uuid4())
        request.request_id = request_id

        response = self.get_response(request)

        duration_ms = round((time.perf_counter() - started) * 1000, 2)
        response["X-Request-ID"] = request_id

        logger.info(json.dumps({
            "request_id": request_id,
            "method": request.method,
            "path": _redact(request.get_full_path()),
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "remote_addr": request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")),
        }))
        return response
