# o2r-finder

Implementation of search features for the o2r API.

## Architecture

Since we want a simple auto-suggest search functionality, which is not readily available with MongoDB (though it has [full text search](https://github.com/o2r-project/o2r-finder/issues/1)), the finder utilizes Elasticsearch.

Since we don't want to worry about keeping things in sync, the finder simply re-indices the whole database at startup and then subscribes to changes in the MongoDB using [node-elasticsearch-sync](https://github.com/toystars/node-elasticsearch-sync) (for both steps).

The Elasticsearch search endpoint is then published read-only via an nginx proxy.

## Indexed information

- whole database _muncher_ (an _index_ in Elasticsearch)
  - all compendia (_collection_ in MongodB, a _type_ in Elasticsearch)
    - `text` documents (detected via mime type of the files) as fields in Elasticsearch
    - pdf __[TODO]__
  - all jobs (_collection_ in MongodB, a _type_ in Elasticsearch)

### Compendia

The MongoDB id is stored as the entry id to allow deletion in Elasticsearch when an element is removed from MongoDB.

The "public" ID for the compendium is stored in `compendium_id`.

Example:

```json
(...])
"hits": {
    "total": 5,
    "max_score": 1.0,
    "hits": [
        {
            "_index": "o2r",
            "_type": "compendia",
            "_id": "57b2eabfa0cd335b5d1192cc",
            "_score": 1.0,
            "_source": {
                "id": "57b2eabfa0cd335b5d1192cc",
                "user": "0000-0001-6021-1617",
                "jobs": [ ],
                "created": "2016-08-16T10:28:15.744Z",
                "compendium_id": "szSuZ"
            }
        }
    ]
    (...)
}
(...)
```

## Requirements

- Elasticsearch server
- Docker
- Node.js
- MondoDB, running with a replication set (!)

## Dockerfile

This project includes a Dockerfile which can be built with

```bash
docker build -t o2r-finder .
```

The image can then be run and configured via environment variables.

### Available environment variables

- `FINDER_PORT` **Required** Port for HTTP requests, defaults to `8084`
- `FINDER_MONGODB_USER_DATABASE` **Required** Full database connection URL and name for MongoDB for user authentication, defaults to `mongodb://localhost/muncher`
- `FINDER_MONGODB_COLL_COMPENDIA` **Required** Name of the MongoDB collection for compendia, default is `compendia`
- `FINDER_MONGODB_COLL_JOBS` **Required** Name of the MongoDB collection for jobs, default is `jobs`
- `FINDER_MONGODB_COLL_SESSION` **Required** Name of the MongoDB collection for session information, default is `sessions` (must match other microservices)
- `FINDER_ELASTICSEARCH_INDEX` Name of the index in Elasticsearch, defaults to `o2r`
- `FINDER_ELASTICSEARCH_TYPE_COMPENDIA` Name of the Elasticsearch type for compendia, default is `compendia`
- `FINDER_ELASTICSEARCH_TYPE_JOBS` Name of the Elasticsearch type for jobs, default is `jobs`
- `SESSION_SECRET` Secret used for session encryption, must match other services, default is `o2r`
- `FINDER_STATUS_LOGSIZE` Number of transformation results in the status log, default is `20`
- [node-elasticsearch-sync](https://github.com/toystars/node-elasticsearch-sync) parameters
  - `ELASTIC_SEARCH_URL` **Required**, e.g. `localhost:9200`
  - `MONGO_OPLOG_URL` **Required**, e.g. `mongodb://localhost/muncher`
  - `MONGO_DATA_URL` **Required**, e.g. `mongodb://localhost/muncher`
  - `BATCH_COUNT` **Required**, e.g. `20`

## Development

Start an Elasticsearch instance, mounting local configuration files (see [documentation](https://hub.docker.com/_/elasticsearch/) and the corresponding GitHub repository, which is the base for the directory `/esconfig`; an empty `scripts` directory is needed so that the whole directory `config` can be mounted without error), and exposing the default port on the host.

```bash
docker run -it --name elasticsearch -v "$(pwd)/esconfig":/usr/share/elasticsearch/config -p 9200:9200 elasticsearch:5
```

**Important**: Starting with Elasticsearch 5, virtual memory configuration of the system (and in our case the host) requires some configuration, particularly of the `vm.max_map_count` setting, see https://www.elastic.co/guide/en/elasticsearch/reference/5.0/vm-max-map-count.html

You can then explore the state of Elasticsearch, e.g.

- http://localhost:9200/
- http://localhost:9200/_nodes
- http://localhost:9200/_cat/health?v
- http://localhost:9200/_cat/indices?v

Start finder (potentially adjust Elasticsearch container's IP, see `docker inspect elasticsearch`)

```bash
npm install
DEBUG=finder FINDER_ELASTICSEARCH=localhost:9200 npm start;
```

You can set `DEBUG=*` to see MongoDB oplog messages.

Now check out the transferred documents:

- http://localhost:9200/o2r
- http://localhost:9200/o2r/compendia/_search?q=*&pretty
- http://localhost:9200/o2r/compendia/57b2eabfa0cd335b5d1192cc (use an ID from before)
  - Looking at this response, you can also see the `_version` field, which is increased every time you restart finder (and full batch processing takes place) or a document is changed.

Delete the index with

```bash
curl -XDELETE 'http://172.17.0.3:9200/o2r/'
```

### Local test proxy

If you run the local test proxy from the project [o2r-platform](https://github.com/o2r-project/o2r-platform), you can run queries directly at the o2r api:

http://localhost/api/v1/search?q=*

## License

o2r-informer is licensed under Apache License, Version 2.0, see file LICENSE.

Copyright (C) 2017 - o2r project.