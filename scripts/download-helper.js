const fs = require('fs');
const https = require('https');
const zlib = require('zlib');
const path = require('path');
const tar = require('tar');
const md5sum = require('md5-file/promise');

// TODO: Change URL from fork to @runk's repo (and master branch)
const link = file => `https://raw.githubusercontent.com/GitSquared/node-geolite2/new-eula-redistribution/redist/${file}`;

const editions = [
  { name: 'GeoLite2-ASN' },
  { name: 'GeoLite2-City' },
  { name: 'GeoLite2-Country' }
];

editions.forEach((edition, index) => {
  editions[index].dbURL = link(edition.name+'.tar.gz');
  editions[index].checksumURL = link(edition.name+'.mmdb.md5');
});

function fetchChecksums() {
  let downloads = [];

  editions.forEach(edition => {
    downloads.push(new Promise(resolve => {
      https.get(edition.checksumURL, res => {
        let checksum = '';
        res.on('data', chunk => {
          checksum = checksum+chunk.toString();
        });
        res.on('end', () => {
          if (!res.complete || checksum.length !== 32) throw new Error(`Could not fetch checksum for ${edition.name}`);
          edition.checksum = checksum;
          resolve();
        });
      });
    }));
  });

  return Promise.all(downloads);
}

function fetchDatabases(outPath) {
  const fetch = url => new Promise(resolve => {
     https.get(edition.dbURL, res => {
        try {
          resolve(res.pipe(zlib.createGunZip({})));
        } catch(_) {
          throw new Error(`Could not fetch ${edition.name}`);
        }
      });
  });

  let downloads = [];

  editions.forEach(edition => {
    downloads.push(new Promise(resolve => {
      fetch(edition.dbURL).then(res => {
        res.pipe(tar.t()).on('entry', entry => {
          if (entry.path.endsWith('.mmdb')) {
            const dstFilename = path.join(outPath, path.basename(entry.path));
            entry.pipe(fs.createWriteStream(dstFilename));
          }
        });
      });
    }));
  });

  return Promise.all(downloads);
}

function verifyAllChecksums(downloadPath) {
  let promises = [];

  editions.forEach(edition => {
    promises.push(new Promise((resolve, reject) => {
      md5sum(path.join(downloadPath, edition.name+'.mmdb.md5')).then(hash => {
        if (hash === edition.checksum) {
          resolve();
        } else {
          reject(`Mismatched checksums for ${edition.name}`);
        }
      }).catch(e => {
        reject(e);
      });
    }));
  });

  return Promise.all(promises);
}

module.exports = {
  fetchChecksums,
  fetchDatabases,
  verifyAllChecksums,
  getEditions: () => {
    return editions;
  }
};
