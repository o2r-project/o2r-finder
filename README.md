# o2r-finder

[![](https://images.microbadger.com/badges/version/o2rproject/o2r-finder.svg)](https://microbadger.com/images/o2rproject/o2r-finder "Get your own version badge on microbadger.com") [![](https://images.microbadger.com/badges/image/o2rproject/o2r-finder.svg)](https://microbadger.com/images/o2rproject/o2r-finder "Get your own image badge on microbadger.com")

Implementation of search features and the endpoint `/api/v1/search` for the o2r API.

## Architecture

The finder utilizes Elasticsearch to provide means for

- A simple auto-suggest search functionality,
- spatial search,
- temporal search,
- and other Elasticsearch [queries](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html).

The auto-suggest search is  is not readily available with MongoDB (though it has [full text search](https://github.com/o2r-project/o2r-finder/issues/1)).

Since we don't want to worry about keeping things in sync, the finder simply re-indices the whole database at startup and then subscribes to changes in the MongoDB using [node-elasticsearch-sync](https://github.com/toystars/node-elasticsearch-sync) (for both steps).

The `/api/v1/search` endpoint allows two types of queries:

1) Simple queries via *GET*: as an [Elasticsearch query string](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-uri-request.html)

2) Complex queries via *POST*: using the [Elasticsearch Query DSL](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl.html)

For more details and examples see the [Search API](http://o2r.info/o2r-web-api/search/) documentation.

### Special characters

The finder supports searching for special characters for these fields:
 
- `metadata.o2r.identifier.doi`
- `metadata.o2r.identifier.doiurl`

To support additional fields with special characters, the mapping in `config/mapping.js` has to be updated in order to copy the fields into the group field `_special`

- When doing a simple query via a query string, both the `_special` and the `_all` fields are searched:

`/api/v1/search?q=10.1006%2Fjeem.1994.1031`

- When doing a complex query, the user has control over which fields are searched. To search both fields nest the queries like this:

```
"query": {
    "bool": {
        "should" : [
            {"query_string": {"default_field": "_all", "query": [...]}},
            {"query_string": {"default_field": "_special", "query": [...]}},
        ]
    }
}
```

Other possible options to search both fields are:

- [Elasticsearch Multi Search API](https://www.elastic.co/guide/en/elasticsearch/reference/current/search-multi-search.html)
- [Elasticsearch Multi Match Query](https://www.elastic.co/guide/en/elasticsearch/reference/current/query-dsl-multi-match-query.html)

## Indexed information

- whole database _muncher_ (an _index_ in Elasticsearch)
  - all compendia (_collection_ in MongoDB, a _type_ in Elasticsearch)
    - `text` documents (detected via mime type of the files) as fields in Elasticsearch
  - all jobs (_collection_ in MongoDB, a _type_ in Elasticsearch)

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

**Note**: If you update the metadata structure of `compendium` or `jobs` and you already have indexed these in elasticsearch, you have to drop the elasticsearch `o2r`-index via

```bash
curl -XDELETE 'http://172.17.0.3:9200/o2r'
```

Otherwise, new compendia will not be indexed anymore.

## Requirements

- Elasticsearch server
- Docker
- Node.js
- MondoDB, running with a replication set (!)

## Dockerfile

This project includes a Dockerfile which can be built and run as follows.
This is not a complete configuration, useful for testing only.

```bash
docker build -t finder .

# start databases in containers (optional)
docker run --name mongodb -d mongo:3.4
docker run --name es -d -e ES_JAVA_OPTS="-Xms512m -Xmx512m" -e "xpack.security.enabled=false" -v "$(pwd)/dev":/usr/share/elasticsearch/config docker.elastic.co/elasticsearch/elasticsearch:5.6.3

docker run -it --link mongodb --link es -e ELASTIC_SEARCH_URL=es:9200 -e FINDER_MONGODB=mongodb://mongodb -e MONGO_OPLOG_URL=mongodb://mongodb/muncher -e MONGO_DATA_URL=mongodb://mongodb/muncher -e DEBUG=finder -p 8084:8084 finder
```

The image can then be configured via environment variables.

### Available environment variables

- `FINDER_PORT` **Required** Port for HTTP requests, defaults to `8084`.
- `FINDER_MONGODB` **Required** Location for the mongo db. Defaults to `mongodb://localhost/`. You will very likely need to change this (and maybe include the MongoDB port).
- `FINDER_MONGODB_DATABASE` Which database inside the mongo db should be used. Defaults to `muncher`.
- `FINDER_MONGODB_COLL_COMPENDIA` Name of the MongoDB collection for compendia, default is `compendia`.
- `FINDER_MONGODB_COLL_JOBS` Name of the MongoDB collection for jobs, default is `jobs`.
- `FINDER_MONGODB_COLL_SESSION` Name of the MongoDB collection for session information, default is `sessions` (must match other microservices).
- `FINDER_ELASTICSEARCH_INDEX` Name of the index in Elasticsearch, defaults to `o2r`.
- `FINDER_ELASTICSEARCH_TYPE_COMPENDIA` Name of the Elasticsearch type for compendia, default is `compendia`
- `FINDER_ELASTICSEARCH_TYPE_JOBS` Name of the Elasticsearch type for jobs, default is `jobs`.
- `SESSION_SECRET` Secret used for session encryption, must match other services, default is `o2r`.
- `FINDER_STATUS_LOGSIZE` Number of transformation results in the status log, default is `20`.
- [node-elasticsearch-sync](https://github.com/o2r-project/node-elasticsearch-sync) parameters
  - `ELASTIC_SEARCH_URL` **Required**, default is `http://localhost:9200`.
  - `MONGO_OPLOG_URL` **Required**, defaults to `FINDER_MONGODB + FINDER_MONGODB_DATABASE`, e.g. `mongodb://localhost/muncher`.
  - `MONGO_DATA_URL` **Required**, defaults to `FINDER_MONGODB + FINDER_MONGODB_DATABASE`, e.g. `mongodb://localhost/muncher`.
  - `BATCH_COUNT` **Required**, defaults to`20`.

## Development

Start an Elasticsearch instance, mounting local configuration files (see [documentation](https://hub.docker.com/_/elasticsearch/) and the corresponding GitHub repository, which is the base for the directory `/dev`; an empty `scripts` directory is needed so that the whole directory `config` can be mounted without error), and exposing the default port on the host.

```bash
docker run -it --name elasticsearch -d -e ES_JAVA_OPTS="-Xms512m -Xmx512m" -e "xpack.security.enabled=false" -v "$(pwd)/dev":/usr/share/elasticsearch/config -p 9200:9200 docker.elastic.co/elasticsearch/elasticsearch:5.6.3
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

If you run the local test proxy from the project [o2r-platform](https://github.com/o2r-project/o2r-platform), you can run queries directly at the o2r API:

http://localhost/api/v1/search?q=*

### Local container testing

The following code assumes the Docker host is available under IP `172.17.0.1` within the container.

```bash
 docker run -it -e DEBUG=finder -e FINDER_MONGODB=mongodb://172.17.0.1 -e ELASTIC_SEARCH_URL=http://172.17.0.1:9200 -p 8084:8084 finder
```

### Tests


Required are running instances of *Elasticsearch*, *MongoDB* and the *o2r-finder* as described above.

To run the included tests, execute

```bash
npm test
```



## License

o2r-informer is licensed under Apache License, Version 2.0, see file LICENSE.

Copyright (C) 2017 - o2r project.