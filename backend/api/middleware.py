from __future__ import annotations

import json
import logging
import time
import uuid


logger = logging.getLogger("api.request")


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
            "path": request.get_full_path(),
            "status_code": response.status_code,
            "duration_ms": duration_ms,
            "remote_addr": request.META.get("HTTP_X_FORWARDED_FOR", request.META.get("REMOTE_ADDR", "")),
        }))
        return response
