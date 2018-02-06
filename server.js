const archiver = require('hypercore-archiver')
const swarm = require('hypercore-archiver/swarm')
const hypercore = require('hypercore')
const hyperdiscovery = require('hyperdiscovery')

const ar = archiver('./pixelpusherd-archive')
ar.on('add', feed => {
  console.log('Add:', feed.key.toString('hex'))
})
ar.on('sync', feed => {
  console.log('Sync:', feed.key.toString('hex'))
})

swarm(ar, {live: true}).on('listening', function () {
  console.log('Swarm listening on port %d', this.address().port)
})

const masterListKeys = new Set()

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
  const sw = hyperdiscovery(masterList)
  sw.on('connection', (peer, info) => {
    console.log('Connection')
    const key = peer.remoteUserData.toString()
    if (key) {
      if (!masterListKeys.has(key)) {
        console.log('Feed key added:', key)
        addChangesFeed(key)
        masterList.append(key)
        console.log('Keys', masterListKeys)
      } else {
        console.log('Already have:', key)
      }
    }
  })
}

function addChangesFeed (key) {
  masterListKeys.add(key)
  ar.add(key)
}
