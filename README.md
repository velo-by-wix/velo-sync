# wix-sync

![license MIT](https://img.shields.io/github/license/yoavaa/velo-sync)
![build for Velo by Wix](https://img.shields.io/badge/Built%20for-Velo%20by%20Wix-blue)

The `Wix-sync` tool is used to sync data into a Wix Data / Content Manager website. 
The tool syncs database items and media files (images, videos, audio files or documents)
making them available in a wix data collection.

Wix Sync supports a few modes of operations

| command | data | description |
|------|------|-----|
| import | data without `id` | each data item is a new item in the collection |
| import | data with an `id` | consolidates new items with the items in the collection based on the `_id` field |
| sync | data without `id` | like import without `id`, but also removes all other items from the collection |
| sync | data with an `id` | like import with an `id`, but also removes all other items from the collection |

* **import** only - which adds new items or updates existing items (matching by `_id`)
* **sync** - which, in addition to import, also removes all other items from the collection





