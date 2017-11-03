const temporal = {
    "query": {
        "bool": {
            "must": {
                "match_all": {}
            },
            "filter": [
                {
                    "range": {
                        "metadata.o2r.temporal.begin": {
                            "from": "2015-01-01T00:00:00.000Z"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.end": {
                            "to": "2016-01-02T00:00:00.000Z"
                        }
                    }
                }
            ]
        }
    },
    "from": 0,
    "size": 10
};

const europe = {
    "query": {
        "bool": {
            "must": {
                "match_all": {}
            },
            "filter": {
                "geo_shape": {
                    "metadata.o2r.spatial.union.geojson.geometry": {
                        "shape": {
                            "type": "polygon",
                            "coordinates":
                                [
                                    [
                                        [
                                            -7.294921874999999,
                                            38.54816542304656
                                        ],
                                        [
                                            34.013671875,
                                            38.54816542304656
                                        ],
                                        [
                                            34.013671875,
                                            68.6245436634471
                                        ],
                                        [
                                            -7.294921874999999,
                                            68.6245436634471
                                        ],
                                        [
                                            -7.294921874999999,
                                            38.54816542304656
                                        ]
                                    ]
                                ]
                        },
                        "relation": "within"
                    }
                }
            }
        }
    }
};

const europe2010 = {
    "query": {
        "bool": {
            "must": {
                "match_all": {}
            },
            "filter": [
                {
                    "geo_shape": {
                        "metadata.o2r.spatial.union.geojson.geometry": {
                            "shape": {
                                "type": "polygon",
                                "coordinates":
                                    [
                                        [
                                            [
                                                -7.294921874999999,
                                                38.54816542304656
                                            ],
                                            [
                                                34.013671875,
                                                38.54816542304656
                                            ],
                                            [
                                                34.013671875,
                                                68.6245436634471
                                            ],
                                            [
                                                -7.294921874999999,
                                                68.6245436634471
                                            ],
                                            [
                                                -7.294921874999999,
                                                38.54816542304656
                                            ]
                                        ]
                                    ]
                            },
                            "relation": "within"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.begin": {
                            "from": "2010-01-01T00:00:00.000Z"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.end": {
                            "to": "2011-01-02T00:00:00.000Z"
                        }
                    }
                }
            ]
        }
    }
};

const world20xx = {
    "query": {
        "bool": {
            "must": {
                "match_all": {}
            },
            "filter": [
                {
                    "geo_shape": {
                        "metadata.o2r.spatial.union.geojson.geometry": {
                            "shape": {
                                "type": "polygon",
                                "coordinates":
                                    [
                                        [
                                            [
                                                -188.4375,
                                                -71.96538769913127
                                            ],
                                            [
                                                192.3046875,
                                                -71.96538769913127
                                            ],
                                            [
                                                192.3046875,
                                                84.37156598282918
                                            ],
                                            [
                                                -188.4375,
                                                84.37156598282918
                                            ],
                                            [
                                                -188.4375,
                                                -71.96538769913127
                                            ]
                                        ]
                                    ]
                            },
                            "relation": "within"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.begin": {
                            "from": "2000-01-01T00:00:00.000Z"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.end": {
                            "to": "2099-01-02T00:00:00.000Z"
                        }
                    }
                }
            ]
        }
    }
};

const wyoming2010 = {
    "query": {
        "bool": {
            "must": {
                "match_all": {}
            },
            "filter": [
                {
                    "geo_shape": {
                        "metadata.o2r.spatial.union.geojson.geometry": {
                            "shape": {
                                "type": "polygon",
                                "coordinates":
                                    [
                                        [
                                            [
                                                -111.09374999999999,
                                                41.0130657870063
                                            ],
                                            [
                                                -104.0625,
                                                41.0130657870063
                                            ],
                                            [
                                                -104.0625,
                                                45.02695045318546
                                            ],
                                            [
                                                -111.09374999999999,
                                                45.02695045318546
                                            ],
                                            [
                                                -111.09374999999999,
                                                41.0130657870063
                                            ]
                                        ]
                                    ]
                            },
                            "relation": "within"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.begin": {
                            "from": "2010-01-01T00:00:00.000Z"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.end": {
                            "to": "2011-01-02T00:00:00.000Z"
                        }
                    }
                }
            ]
        }
    }
};

const invalid = {
    "query": {
        "bool": {
            "must": {
                "match_all": {}
            },
            "filter": [
                {
                    "geo_shape": {
                        "metadata.o2r.spatial.union.geojson.geometry": {
                            "shape": {
                                "type": "polygon",
                                "coordinates":
                                    [
                                        [
                                            [
                                                34.013671875,
                                                38.54816542304656
                                            ],
                                            [
                                                34.013671875,
                                                68.6245436634471
                                            ],
                                            [
                                                -7.294921874999999,
                                                68.6245436634471
                                            ],
                                            [
                                                -7.294921874999999,
                                                38.54816542304656
                                            ]
                                        ]
                                    ]
                            },
                            "relation": "within"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.begin": {
                            "from": "2010-01-01T00:00:00.000Z"
                        }
                    }
                },
                {
                    "range": {
                        "metadata.o2r.temporal.end": {
                            "to": "2011-01-02T00:00:00.000Z"
                        }
                    }
                }
            ]
        }
    }
};

module.exports = {
    temporal: temporal,
    europe: europe,
    europe2010: europe2010,
    world2015: world20xx,
    wyoming2010: wyoming2010,
    invalid: invalid
};