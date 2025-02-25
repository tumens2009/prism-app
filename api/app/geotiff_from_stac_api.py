import os
from uuid import uuid4

import boto3
from cachetools import TTLCache, cached
from fastapi import HTTPException
from odc.geo.xr import write_cog
from odc.stac import configure_rio, stac_load
from pystac_client import Client

STAC_URL = "https://api.earthobservation.vam.wfp.org/stac"

AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID")
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY")

GEOTIFF_BUCKET_NAME = "prism-stac-geotiff"

configure_rio(
    cloud_defaults=True,
    aws={
        "aws_access_key_id": AWS_ACCESS_KEY_ID,
        "aws_secret_access_key": AWS_SECRET_ACCESS_KEY,
    },
)


def generate_geotiff_from_stac_api(
    collection: str, bbox: [float, float, float, float], date: str
) -> str:
    """Query the stac API with the params and generate a geotiff"""
    file_path = f"{collection}_{date}_{str(uuid4())[:8]}.tif"
    catalog = Client.open(STAC_URL)

    query_answer = catalog.search(bbox=bbox, collections=[collection], datetime=[date])
    items = list(query_answer.items())

    if not items:
        raise HTTPException(status_code=500, detail="Collection not found in stac API")

    collections_dataset = stac_load(
        items,
        bbox=bbox,
    )

    write_cog(collections_dataset[list(collections_dataset.keys())[0]], file_path)

    return file_path


def upload_to_s3(file_path: str) -> str:
    """Upload to s3"""
    s3_client = boto3.client("s3")
    s3_filename = os.path.basename(file_path)

    s3_client.upload_file(file_path, GEOTIFF_BUCKET_NAME, s3_filename)
    return s3_filename


@cached(cache=TTLCache(maxsize=128, ttl=60 * 60 * 24 * 6))
def generate_geotiff_and_upload_to_s3(
    collection: str, bbox: [float, float, float, float], date: str
) -> str:
    """
    Query the stac API with the params, generate a geotiff, save it in an S3 bucket

    """
    file_path = generate_geotiff_from_stac_api(collection, bbox, date)
    s3_filename = upload_to_s3(file_path)
    os.remove(file_path)

    return s3_filename


def get_geotiff(collection: str, bbox: [float, float, float, float], date: str):
    """Generate a geotiff and return presigned download url"""
    s3_filename = generate_geotiff_and_upload_to_s3(collection, bbox, date)

    s3_client = boto3.client("s3")
    presigned_download_url = s3_client.generate_presigned_url(
        "get_object",
        Params={"Bucket": GEOTIFF_BUCKET_NAME, "Key": s3_filename},
        ExpiresIn=3600,
    )
    return presigned_download_url
