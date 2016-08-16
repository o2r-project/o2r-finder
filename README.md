# o2r-finder

Implementation of search features for the o2r API

Since we want a simple auto-suggest search functionality, which is not readily available with MongoDB (though it has [full text search](https://github.com/o2r-project/o2r-finder/issues/1)), the finder utilizes Elasticsearch.

Since we don't want to worry about keeping things in sync, the finder simply re-indices the whole database at startup and then subscribes to changes in the MongoDB using [node-elasticsearch-sync](https://github.com/toystars/node-elasticsearch-sync) for both steps.

The Elasticsearch search endpoint is then published read-only via an nginx proxy.

## Indexed information

- whole database _muncher_ (an _index_ in Elasticsearch)
  - all compendia (_collection_ in MongodB, a _type_ in Elasticsearch)
    - txt __[TODO]__
    - pdf __[TODO]__
  - all jobs (_collection_ in MongodB, a _type_ in Elasticsearch)

### Compendia

The MongoDB id is stored as the entry id to allow deletion in Elasticsearch when an element is removed from MongoDB.

The "public" ID for the compendium is stored in `compendium_id`.

Example:

```json
[...]
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
        },
[...]
```

## Requirements

- Elasticsearch server
- Docker
- Node.js
- MondoDB, running with a replication set

## Dockerfile

This project includes a Dockerfile which can be built with

```bash
docker build -t o2r-finder .
```

The image can then be run and configured via environment variables.

### Available environment variables

- `FINDER_MONGODB` **Required** Hostname for the MongoDB, defaults to `localhost'
- `FINDER_MONGODB_DATABASE` **Required** Database name in MongodB, defaults to `muncher`
- `FINDER_ELASTICSEARCH` **Required** Elasticsearch endpoint, defaults to `elasticsearch:9200`
- `FINDER_ELASTICSEARCH_INDEX` **Required** Name of the index in Elasticsearch, defaults to `o2r`

## Development

Start an Elasticsearch instance, mounting a local configuratione file (see [documentation](https://hub.docker.com/_/elasticsearch/)).

```bash
docker run -it --name elasticsearch -v "$(pwd)/esconfig/elasticsearch.yml":/usr/share/elasticsearch/config/elasticsearch.yml elasticsearch:2
```

You can then explore the state of Elasticsearch, e.g.

- http://172.17.0.3:9200/
- http://172.17.0.3:9200/_nodes
- http://172.17.0.3:9200/_cat/health?v
- http://172.17.0.3:9200/_cat/indices?v

Start finder (potentially adjust Elasticsearch container's IP, see `docker inspect elasticsearch`)

```bash
npm install
DEBUG=finder FINDER_ELASTICSEARCH=172.17.0.3:9200 npm start;
```

Now check out the transferred documents:

- http://172.17.0.3:9200/o2r
- http://172.17.0.3:9200/o2r/compendia/_search?q=*&pretty


Delete the index with

```bash
curl -XDELETE 'http://172.17.0.3:9200/o2r/'
```

## License

o2r-informer is licensed under Apache License, Version 2.0, see file LICENSE.

Copyright (C) 2016 - o2r project.