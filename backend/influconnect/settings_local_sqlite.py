"""Local-only settings: run manage.py commands (makemigrations, tests) without
a PostgreSQL server. Not used in docker/prod."""
from .settings import *  # noqa: F401,F403

DATABASES = {
    'default': {
        'ENGINE': 'django.db.backends.sqlite3',
        'NAME': BASE_DIR / 'local_dev.sqlite3',  # noqa: F405
    }
}

# The whole test suite shares one in-memory throttle cache; the production
# login rate (10/min/IP) would fail tests that log in repeatedly.
REST_FRAMEWORK = {**REST_FRAMEWORK}  # noqa: F405
REST_FRAMEWORK['DEFAULT_THROTTLE_RATES'] = {
    key: '1000/min' for key in REST_FRAMEWORK['DEFAULT_THROTTLE_RATES']
}
