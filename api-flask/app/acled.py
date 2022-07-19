"""Fetch armed conflict incidents from acled API."""
from os import getenv

from flask import request
from requests import get
from werkzeug.exceptions import InternalServerError

ACLED_BASE_URL = "https://api.acleddata.com/acled/read"


def get_acled_incidents():
    """Include required credentials and forward request."""
    api_key = getenv("ACLED_API_KEY", None)
    if api_key is None:
        raise InternalServerError("Missing environment variable ACLED_API_KEY")

    api_email = getenv("ACLED_API_EMAIL", None)
    if api_key is None:
        raise InternalServerError("Missing environment variable ACLED_API_EMAIL")

    api_required_params = {"key": api_key, "email": api_email}

    # Make a new request to acled api including the credentials.
    params = {**api_required_params, **dict(request.args)}
    response = get(ACLED_BASE_URL, params=params)

    return response.content
