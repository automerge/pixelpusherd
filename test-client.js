const fs = require('fs')
const hypercore = require('hypercore')
const hyperdiscovery = require('hyperdiscovery')
const ram = require('random-access-memory')

const key = fs.readFileSync('pixelpusherd-archive/master-list/key')
const publishKey = process.argv[2]

if (!publishKey) {
  console.error('Need a key')
  process.exit(1)
}

console.log('Connecting to:', key.toString('hex'))
console.log('Pushing key:', publishKey)

const feed = hypercore(ram, key)
feed.ready(() => {
  const userData = JSON.stringify({
    key: publishKey
  })
  const sw = hyperdiscovery(feed, {
    stream: () => feed.replicate({userData})
  })
  sw.on('connection', peer => {
    try {
      const name = JSON.parse(peer.remoteUserData.toString()).name
      console.log('Remote name:', name)
      if (sw.connections.length > 0) {
        process.exit()
      }
    } catch (e) {
      console.error(e.message)
    }
  })
})
