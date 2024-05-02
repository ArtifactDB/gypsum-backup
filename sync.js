import * as fs from "fs";
import * as path from "path";
import { S3Client } from '@aws-sdk/client-s3';
import { S3SyncClient } from 's3-sync-client';

const args = process.argv;
const backup_dir = args[2];
const expiration = args[3];

// Scanning the backup directory and purging all the old backups, except for the latest.
const now = new Date;
let backup_latest = null;
let purge_backup_latest = false;

if (fs.existsSync(backup_dir)) {
    const all_backups = fs.readdirSync(backup_dir);
    const expiry_ms = expiration * 24 * 60 * 60 * 1000;

    let age_latest;
    const actions = [];
    for (const b of all_backups) {
        const age = new Date(b);
        const act = { name: b, purge: true }
        if (!Number.isNaN(age.getTime())) {
            if (now.getTime() - age.getTime() < expiry_ms) {
                act.purge = false;
            }
            if (age_latest == null || age_latest.getTime() < age.getTime()) {
                age_latest = age;
                backup_latest = b;
            }
        }
        actions.push(act);
    }

    for (const { name, purge } of actions) {
        if (purge) {
            if (name != backup_latest) {
                fs.rmSync(path.join(backup_dir, name), { recursive: true, force: true });
            } else {
                purge_backup_latest = true;
            }
        }
    }
} else {
    fs.mkdirSync(backup_dir);
}

// Make a local copy of the latest backup so that the aws sync has less work to do, hopefully.
const backup_now = now.toISOString().split('T')[0]
const backup_dest = path.join(backup_dir, backup_now);
const backup_tmp = backup_dest + "_tmp";

if (!fs.existsSync(backup_tmp) && backup_latest) {
    if (all_backups.length > 0) {
        fs.cpSync(path.join(backup_dir, backup_last), backup_tmp, { recursive: true });
    }
}

// Syncing the bucket to a temporary directory.
const cred_res = await fetch("https://gypsum.artifactdb.com/credentials/s3-api");
if (!cred_res.ok) {
    throw new Error("failed to fetch S3 credentials");
}
const credentials = await cred_res.json();

const client = new S3Client({
    region: "auto",
    endpoint: credentials.endpoint,
    credentials: {
        accessKeyId: credentials.key,
        secretAccessKey: credentials.secret
    }
});
const { sync } = new S3SyncClient({ client: client });
await sync("s3://" + credentials.bucket, backup_tmp, { del: true });

// Renaming the directory to its intended location and mopping up.
fs.renameSync(backup_tmp, backup_dest);
if (purge_backup_latest) {
    fs.rmSync(path.join(backup_dir, backup_latest), { recursive: true, force: true })
}
