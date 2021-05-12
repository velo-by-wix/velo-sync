#!/bin/sh

node dist/cli import -f example-datasets/pics-on-disk.csv -c Items -s example-datasets/pics-on-disk-schema.json --dry
node dist/cli import -f example-datasets/data-without-id.csv -c Items -s example-datasets/data-without-id-schema.json --dry
node dist/cli import -f example-datasets/rejects.csv -c Items -s example-datasets/rejects-schema.json --dry
node dist/cli import -f example-datasets/remote-pics.csv -c Items -s example-datasets/remote-pics-schema.json --dry
node dist/cli import -f example-datasets/gallery-on-disk.csv -c Items -s example-datasets/gallery-on-disk-schema.json --dry
node dist/cli import -f example-datasets/videos.csv -c Items -s example-datasets/videos-schema.json --dry
node dist/cli import -f example-datasets/music.csv -c Items -s example-datasets/music-schema.json --dry
node dist/cli import -f example-datasets/documents.csv -c Items -s example-datasets/documents-schema.json --dry
node dist/cli sync -f example-datasets/Art.csv -c Items -s example-datasets/Art-schema.json --dry