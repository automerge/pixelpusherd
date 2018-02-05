// const archiver = require('hypercore-archiver')
// const swarm = require('hypercore-archiver/swarm')
const hypercore = require('hypercore')
const hyperdiscovery = require('hyperdiscovery')

// const ar = archiver('./pixelpusherd-archive')

const masterList = hypercore('./pixelpusherd-archive/master-list')
masterList.ready(() => {
  console.log('Key:', masterList.key.toString('hex'))

  const masterListKeys = new Set()

  const sw = hyperdiscovery(masterList)
  sw.on('connection', (peer, info) => {
    console.log('Connection to master list')
    const key = peer.remoteUserData.toString()
    if (key) {
      if (!masterListKeys.has(key)) {
        console.log('Feed key added:', key)
        masterListKeys.add(key)
        console.log('Keys', masterListKeys)
      }
    }
  })
})
