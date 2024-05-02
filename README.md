# Local backups for the gypsum store

This repository holds scripts to periodically create local backups of the [**gypsum**](https://github.com/ArtifactDB/gypsum-worker) data store.
To get started, clone this repository and install the dependencies:

```shell
git clone https://github.com/ArtifactDB/gypsum-backup
cd gypsum-backup
npm i
```

Run the `sync.js` backup script (tested on Node 20).
This will create a new backup in the `backups` directory, named after the current day.
All backups in `backup` that are older than 30 days will be removed. 
Users can run this at their desired frequency to generate a backup every day, or week, or month, etc.

```shell
node sync.js backups 30
```

In addition, we can validate the contents of each backup directory with the `validate.js` script.
This ensures that each file was correctly downloaded.

```shell
node validate.js backups/2024-05-02
```
