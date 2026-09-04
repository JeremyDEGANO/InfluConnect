"""Address autocomplete backed by open, maintained datasets.

Two providers, picked by country so each query hits the best source:

  * France -> BAN (api-adresse.data.gouv.fr), the official French address base
    (DGFiP/IGN). Free, no API key, house-number level precision.
  * Everywhere else -> Photon (photon.komoot.io), an OpenStreetMap geocoder.
    Free, no API key, worldwide.

Calls are proxied through the backend rather than made from the browser so the
User-Agent and rate limiting stay under our control, results are normalised to
one shape, and swapping provider later needs no frontend change.
"""
from __future__ import annotations

import hashlib
import logging

import requests
from django.core.cache import cache

logger = logging.getLogger(__name__)

BAN_URL = "https://api-adresse.data.gouv.fr/search/"
PHOTON_URL = "https://photon.komoot.io/api/"
USER_AGENT = "InfluConnect/1.0 (+https://influconnect.fr)"
TIMEOUT = 5  # seconds — the UI types ahead, a slow provider must not hang it
CACHE_TTL = 60 * 60 * 24  # identical prefixes are re-queried constantly
MAX_RESULTS = 8


class AddressLookupError(RuntimeError):
    """The upstream provider could not be reached or answered badly."""


def _cache_key(query: str, country: str) -> str:
    # Hashed: raw addresses contain spaces and accents, which are not valid in
    # a memcached key and make Django warn on every lookup.
    digest = hashlib.sha1(query.lower().strip().encode("utf-8")).hexdigest()[:24]
    return f"addr:{country.lower()}:{digest}"


def _from_ban(feature: dict) -> dict:
    props = feature.get("properties") or {}
    return {
        "label": props.get("label") or "",
        "street": (
            f"{props.get('housenumber', '')} {props.get('street', '')}".strip()
            or props.get("name")
            or ""
        ),
        "postal_code": props.get("postcode") or "",
        "city": props.get("city") or "",
        "country": "FR",
        "source": "ban",
    }


def _from_photon(feature: dict) -> dict:
    props = feature.get("properties") or {}
    street = " ".join(
        part for part in [props.get("housenumber"), props.get("street")] if part
    ).strip()
    if not street:
        # A POI or a street without a number: fall back to its name.
        street = props.get("name") or ""
    city = props.get("city") or props.get("town") or props.get("village") or ""
    label = ", ".join(
        part for part in [street, props.get("postcode"), city, props.get("country")] if part
    )
    return {
        "label": label,
        "street": street,
        "postal_code": props.get("postcode") or "",
        "city": city,
        "country": (props.get("countrycode") or "").upper(),
        "source": "photon",
    }


def search(query: str, country: str = "FR", limit: int = 5) -> list[dict]:
    """Suggestions for a partially typed address.

    Returns a list of dicts with label/street/postal_code/city/country so the
    form can fill every field from one pick. Never raises for an empty query.
    """
    query = (query or "").strip()
    country = (country or "FR").strip().upper()[:2] or "FR"
    if len(query) < 3:
        return []
    limit = max(1, min(int(limit or 5), MAX_RESULTS))

    key = _cache_key(query, country)
    cached = cache.get(key)
    if cached is not None:
        return cached[:limit]

    try:
        if country == "FR":
            response = requests.get(
                BAN_URL,
                params={"q": query, "limit": limit, "autocomplete": 1},
                timeout=TIMEOUT,
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            features = (response.json() or {}).get("features") or []
            results = [_from_ban(f) for f in features]
        else:
            response = requests.get(
                PHOTON_URL,
                params={"q": query, "limit": limit, "lang": "fr"},
                timeout=TIMEOUT,
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            features = (response.json() or {}).get("features") or []
            results = [_from_photon(f) for f in features]
            # Photon ignores a country filter, so narrow it ourselves.
            results = [r for r in results if not r["country"] or r["country"] == country]
    except requests.RequestException as exc:
        logger.warning("address lookup failed (%s, %s): %s", country, query, exc)
        raise AddressLookupError(str(exc)) from exc
    except ValueError as exc:  # malformed JSON
        logger.warning("address lookup returned invalid JSON: %s", exc)
        raise AddressLookupError("invalid response") from exc

    # Keep only entries a form can actually use.
    results = [r for r in results if r["label"]]
    cache.set(key, results, CACHE_TTL)
    return results[:limit]


def _city_from_ban(feature: dict) -> dict:
    props = feature.get("properties") or {}
    city = props.get("city") or props.get("name") or ""
    return {
        "label": f"{city} ({props.get('postcode')})" if props.get("postcode") else city,
        "city": city,
        "postal_code": props.get("postcode") or "",
        "country": "FR",
    }


def _city_from_photon(feature: dict) -> dict:
    props = feature.get("properties") or {}
    city = props.get("name") or props.get("city") or ""
    country = (props.get("countrycode") or "").upper()
    label = ", ".join(part for part in [city, props.get("state"), props.get("country")] if part)
    return {
        "label": label or city,
        "city": city,
        "postal_code": props.get("postcode") or "",
        "country": country,
    }


def search_cities(query: str, country: str = "FR", limit: int = 5) -> list[dict]:
    """City suggestions, for profiles that only need a city (influencers).

    A fixed dropdown of big cities leaves creators in smaller towns unable to
    state where they are; this covers every municipality instead.
    """
    query = (query or "").strip()
    country = (country or "FR").strip().upper()[:2] or "FR"
    if len(query) < 2:
        return []
    limit = max(1, min(int(limit or 5), MAX_RESULTS))

    key = _cache_key(f"city:{query}", country)
    cached = cache.get(key)
    if cached is not None:
        return cached[:limit]

    try:
        if country == "FR":
            response = requests.get(
                BAN_URL,
                params={"q": query, "type": "municipality", "limit": limit, "autocomplete": 1},
                timeout=TIMEOUT,
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            features = (response.json() or {}).get("features") or []
            results = [_city_from_ban(f) for f in features]
        else:
            response = requests.get(
                PHOTON_URL,
                params={"q": query, "limit": limit, "lang": "fr", "osm_tag": "place:city"},
                timeout=TIMEOUT,
                headers={"User-Agent": USER_AGENT},
            )
            response.raise_for_status()
            features = (response.json() or {}).get("features") or []
            results = [_city_from_photon(f) for f in features]
            results = [r for r in results if not r["country"] or r["country"] == country]
    except requests.RequestException as exc:
        logger.warning("city lookup failed (%s, %s): %s", country, query, exc)
        raise AddressLookupError(str(exc)) from exc
    except ValueError as exc:
        logger.warning("city lookup returned invalid JSON: %s", exc)
        raise AddressLookupError("invalid response") from exc

    # De-duplicate on the city name, keeping order.
    seen: set[str] = set()
    unique = []
    for item in results:
        name = item["city"].lower()
        if not item["city"] or name in seen:
            continue
        seen.add(name)
        unique.append(item)

    cache.set(key, unique, CACHE_TTL)
    return unique[:limit]
