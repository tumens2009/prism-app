# PRISM API

The PRISM API is a lightweight API to calculate zonal statistics.

The API has two endpoints for now.

## Endpoints

### `/stats` (POST)

Calculate zonal statistics for a raster / zones combination. Which takes as inputs through POST:

- `geotiff_url`, the link to a geotiff
- `zones_url` OR `zones`, the link to a geojson with admin boundaries / a geojson with boundaries
- `?group_by`, a key to use to group zones in the geojson
- `?geojson_out`, decide if the output should be a geojson or a list of data. Default is false -> List.
- `?intersect_comparison`, ask the API to calcuate and return `intersect_percentage`. Formatted as `>=10.1`. Comparison defaults to equality if omitted.
- `?wfs_params`, A dictionary of parameters to compute statistics using the intersection between WFS FeatureCollection response polygons with admin boundaries. The parameters are the following.
  - `url`, WFS remote service url.
  - `layer_name`, the name of the vector layer. Geometry must be POLYGON or MULTIPOLYGON.
  - `key`, Geojson property field to be extracted for each feature.
  - `?time`, Layer TIME dimension if enabled.
- `?filter_by`, A dictionary of parameters that filters the features that match the geojson property key and value specified within the request.
  - `key`, feature property key.
  - `value`, feature property value.

### `/demo` (GET)

Exposes a sample API response and takes the following query arguments:

- `?group_by`, a key to use to group zones in the geojson, eg. `ADM1_PCODE`
- `?geojson_out`, decide if the output should be a geojson or a list of data. Default is false -> List.

### `/alerts-all` (GET)

Return all the alerts data that `alert` table holds

```
curl --location --request GET 'localhost:80/alerts-all' > data.json
```

### `/alerts` (GET)

Based on the parameter from request URL, this endpoint will return the matched
alert rows from DB.

- `id` return alert data that has `id`
- TODO: more GET all operations will be supported for different query cases

```
curl --location --request GET 'localhost:80/alerts?id=3'
```

### `/alerts` (POST)

One successful call will create a new entry in database `alert` table. The JSON
data should match the model defined in `AlertModel`.

```
curl --location --request POST 'localhost:80/alerts' \
--header 'Content-Type: application/json' -d @example_alert_post.json
```

The following endpoints are related to data retrieval from KoboToolbox. Make sure
you have set the environment variables KOBO_USERNAME, KOBO_PW

### `/acled` (GET)

Returns armed conflict incidents using ACLED api. Make sure to have the defined ACLED credentials using environment variables `ACLED_API_KEY` and `ACLED_API_EMAIL`

- `iso`, Country ISO code defined in Acled file. Verify documentation.
- `limit`, Maximum number of results. 0 corresponds to all incidents.
- `?fields`, Comma separated string which specifies the fields to be returned per incident.
- `?event_date`, Return incidents only matching the given value with format YYYY-MM-DD


### `/kobo/forms` (GET)

Returns all form responses using Kobo API

- `nameField`, The name of the Kobo form.
- `datetimeField`, Field used to collect all timestamps.
- `geomField`, form field which contains lat lon coordinates.
- `measureField`, form field used for legend rendering. Backend converts string form value to number.
- `?beginDateTime`, Filter forms starting from given date.
- `?endDateTime`, Filter forms whose date field is lower than value provided.
- `?filterStatus`, Filter forms that match the given value. Possible values are 'Approved', 'Not Approved' and 'On Hold'

```
curl -X GET 'http://localhost/kobo/forms?nameField=Test%20MMR&datetimeField=_submission_time&geomField=Location&measureField=The_number&beginDateTime=2021-09-15&endDateTime=2021-09-29'
```

### `/raster_geotiff` (POST)

Generate a geotiff for any wfp raster using the stac API and saves it in S3. It returns the pre signed S3 geotiff URL.

- `collection`, the name of the collection to get. For example `r3h_dekad`.
- `date`, date of the data to get. For example : `2020-09-01`.
- `lat_min`, min latitude (to define the bounding box of the geotiff).
- `long_min`, min longitude (to define the bounding box of the geotiff).
- `lat_max`, max latitude (to define the bounding box of the geotiff).
- `long_max`, max longitude (to define the bounding box of the geotiff).

## Development

To run the api locally, run:

```
make api
```

To run flask api together with database within same network, run:

```
docker-compose -f ./docker-compose.develop.yml -f ../alerting/docker-compose.yml up
```

### Tests

To run linting and tests, run:

```
make test
```

## Deployments

We are using [docs.traefik.io](https://docs.traefik.io/)
To deploy the application, update the file `docker-compose.deploy.yml`.
Specifically, update `info@ovio.org` with a domain admin email and `prism-api.ovio.org` with the hostname you will be using.

To deploy, run:

```
make deploy
```

There are a few known issues happening from time to time

- `permission denied` when restarting or killing a docker image. To fix it, run `sudo aa-remove-unknown` and re-run your command.

- `address already in use`. To bypass it, run the following commands for the ports you need:

```
# Find process ids
sudo lsof -i -P -n | grep PORT
# Kill processes
sudo kill PROCESS_ID
```
