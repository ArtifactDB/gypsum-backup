import * as fs from "fs";
import * as path from "path";
import * as crypto from "crypto";

const dir = "backups/2024-05-02";

// Parsing all manifests for link resolution.
const all_manifests = {};
for (const project of fs.readdirSync(dir)) {
    if (project.startsWith("..")) {
        continue;
    }

    const project_dir = path.join(dir, project);
    for (const asset of fs.readdirSync(project_dir)) {
        if (asset.startsWith("..")) {
            continue;
        }

        const asset_dir = path.join(project_dir, asset);
        for (const version of fs.readdirSync(asset_dir)) {
            if (version.startsWith("..")) {
                continue;
            }

            const version_dir = path.join(asset_dir, version);
            const manifest = JSON.parse(fs.readFileSync(path.join(version_dir, "..manifest"), { encoding: "utf8" }));
            all_manifests[project + "/" + asset + "/" + version] = manifest;
        }
    }
}

// Verifying the contents of the bucket.
for (const [key, manifest] of Object.entries(all_manifests)) {
    for (const [rel, info] of Object.entries(manifest)) {
        const target = path.join(key, rel);
        const full = path.join(dir, target);

        if (!("link" in info)) {
            if (!fs.existsSync(full)) {
                console.log(`${target}\tdoes not exist`);
                continue;
            }

            const finfo = fs.statSync(full);
            if (finfo.size != info.size) {
                console.log(`${target}\tmismatch in size`);
                continue;
            }

            const m5sum = await new Promise(resolve => {
                const hash = crypto.createHash("md5");
                const stream = fs.createReadStream(full);
                stream.on("data", data => hash.update(data));
                stream.on("end", () => resolve(hash.digest("hex")));
            });
            if (m5sum != info.md5sum) {
                console.log(`${target}\tmismatch in checksum`);
                continue;
            }

        } else {
            const link_dest = info.link.project + "/" + info.link.asset + "/" + info.link.version;
            if (!(link_dest in all_manifests)) {
                console.log(`${target}\tlink target does not exist`);
                continue;
            }

            const link_manifest = all_manifests[link_dest];
            if (!(info.link.path in link_manifest)) {
                console.log(`${target}\tlink target does not exist`);
                continue;
            }

            const link_info = link_manifest[info.link.path];
            if (link_info.size != info.size || link_info.md5sum != info.md5sum) {
                console.log(`${target}\tlink target size and checksum do not match`);
                continue;
            }

            if (("ancestor" in info.link) != ("link" in link_info)) {
                console.log(`${target}\tlink ancestor should be present iif link target is also linked`);
                continue;
            }

            if ("ancestor" in info.link) {
                let expected_path;
                let expected_dest;
                if ("ancestor" in link_info.link) {
                    expected_dest = link_info.link.ancestor.project + "/" + link_info.link.ancestor.asset + "/" + link_info.link.ancestor.version;
                    expected_path = link_info.link.ancestor.path;
                } else {
                    expected_dest = link_info.link.project + "/" + link_info.link.asset + "/" + link_info.link.version;
                    expected_path = link_info.link.path;
                }

                const ancestor_dest = info.link.ancestor.project + "/" + info.link.ancestor.asset + "/" + info.link.ancestor.version;
                if (ancestor_dest !== expected_dest || info.link.ancestor.path !== expected_path) {
                    console.log(`${target}\tlink ancestor is not consistent with information in link target`);
                    continue;
                }

                if (!(ancestor_dest in all_manifests)) {
                    console.log(`${target}\tlink ancestor target does not exist`);
                    continue;
                }

                const ancestor_manifest = all_manifests[ancestor_dest];
                if (!(info.link.ancestor.path in ancestor_manifest)) {
                    console.log(`${target}\tlink ancestor target does not exist`);
                    continue;
                }

                const ancestor_info = link_manifest[info.link.ancestor.path];
                if (ancestor_info.size != info.size || ancestor_info.md5sum != info.md5sum) {
                    console.log(`${target}\tancestor link target size and checksum do not match`);
                    continue;
                }
            }
        }
    }
}
