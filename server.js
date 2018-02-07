const archiver = require('hypercore-archiver')
const swarm = require('hypercore-archiver/swarm')
const hypercore = require('hypercore')
const hyperdiscovery = require('hyperdiscovery')
const prettyHash = require('pretty-hash')
const minimist = require('minimist')

const argv = minimist(process.argv.slice(2), {boolean: ['debug']})
if (argv.help || !argv.name) {
  console.log('Usage: node server --name=<name> [--debug]\n')
  process.exit(1)
}

const masterListKeys = new Set()

const ar = archiver('./pixelpusherd-archive')
ar.on('add', feed => {
  const isChangesFeed = masterListKeys.has(feed.key.toString('hex'))
  console.log(
    'Add:',
    prettyHash(feed.key),
    isChangesFeed ? '(Feed)' : '',
    feed.length
  )
  if (isChangesFeed) {
    processChanges(feed)
  }
})
ar.on('sync', feed => {
  const isChangesFeed = masterListKeys.has(feed.key.toString('hex'))
  console.log(
    'Sync:',
    prettyHash(feed.key),
    isChangesFeed ? '(Feed)' : '',
    feed.length
  )
  if (isChangesFeed) {
    processChanges(feed)
  }
})

swarm(ar, {live: true}).on('listening', function () {
  console.log('Swarm listening on port %d', this.address().port)
})

const masterList = hypercore('./pixelpusherd-archive/master-list')
masterList.ready(() => {
  console.log('Key:', masterList.key.toString('hex'))

  masterList.createReadStream()
    .on('data', data => {
      const key = data.toString()
      addChangesFeed(key)
    })
    .on('error', err => {
      console.error('Error', err)
      process.exit(1)
    })
    .on('end', () => {
      masterList.on('append', data => {
        console.log('Append to master list', masterList.length)
      })
      joinSwarm()
    })
})

function joinSwarm () {
  const userData = JSON.stringify({
    name: argv.name
  })
  const sw = hyperdiscovery(masterList, {
    stream: () => masterList.replicate({live: true, userData})
  })
  sw.on('connection', (peer, info) => {
    console.log('Connection')
    peer.on('error', err => { console.error('Error', err) })
    peer.on('close', () => { console.log('Closed') })
    if (!peer.remoteUserData) return
    let key
    try {
      const json = JSON.parse(peer.remoteUserData.toString())
      key = json.key
    } catch (e) {
      console.error('Error parsing userData -- not JSON?')
    }
    if (key) {
      if (!masterListKeys.has(key)) {
        console.log('Feed key added:', key)
        addChangesFeed(key)
        masterList.append(key)
        console.log('Keys', masterListKeys)
      } else {
        console.log('Already have:', key)
      }
    } else {
      console.log('Feed key not found')
    }
  })
}

function addChangesFeed (key) {
  masterListKeys.add(key)
  ar.add(key)
}

function processChanges (feed) {
  console.log('  Processing:', prettyHash(feed.key), feed.length)

  // Process feeds similarly to hypercore-archiver ._open()
  const latest = new Set()
  feed.createReadStream()
    .on('data', data => {
      try {
        const json = JSON.parse(data)
        if (json.type === 'add') {
          latest.add(json.key)
        } else {
          latest.delete(json.key)
        }
      } catch (e) {
        console.error('JSON parse error', e)
      }
    })
    .on('error', err => {
      console.error('processChanges error', err)
    })
    .on('end', () => {
      latest.forEach(key => {
        // Note: We never delete keys that have been added
        console.log('   ', prettyHash(key))
        ar.add(key)
      })
    })
}
